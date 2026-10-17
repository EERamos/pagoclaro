#!/usr/bin/env node
// Anti-gaming guard for the build phase: a Claude Code PreToolUse hook.
// Adapted from agent-cycle's guard_artifacts.py (MIT, Alan Vazquez; see NOTICE), its v0.12.0
// rules for the settings files, git verbs, the ratchet, per-agent freezing and links included.
//
// One guard per repository: installed as <repo>/.claude/hooks/guard-artifacts.mjs and run as
// `node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-artifacts.mjs"` (templates/build/settings.json),
// CLAUDE_PROJECT_DIR being the repository root. Claude Code pipes the tool call as JSON on stdin,
// { tool_name, tool_input, cwd }. Exit 0 lets the call run; exit 2 blocks it and shows stderr to
// the builder. Any other exit, including the 1 that node gives for a script it cannot load, is a
// non-blocking error: the call runs. That is deliberate (re-entry has the owner rename the script
// away, and settings.json must not say `|| exit 2`, which would turn that 1 into a block of every
// call), so the net for a missing or altered guard is `chain`'s rail check, not this file.
// GUARD_VERSION, below, is the plugin release the file comes from.
//
// Agents and freezing:
//   - The agent roots are the repository root and every agents/<domain>/<bot>/ folder (listed on
//     each call, two levels down, never deeper); a path belongs to the deepest one that holds it.
//   - An agent is frozen once its docs/agent/build.md exists or the ratchet lists it. The ratchet
//     is .claude/hooks/built-agents.txt, tracked in git, UTF-8: one agent prefix per line, "." for
//     the repository root, agents/<domain>/<bot>/ otherwise (a part may hold spaces, never a / or a
//     control character; a byte-order mark and the spaces around a line are ignored, and a folder
//     name with a control character is never recorded). On every call, before deciding, the guard
//     appends the prefix of each agent whose build.md exists and is not listed, a write of its own
//     and not a tool call's; when that write fails the call is still judged from the ratchet as
//     read plus what is on disk, never let through. A listed agent whose build.md is gone stays
//     frozen, without the Test-column exception. A ratchet that cannot be read (not UTF-8, a
//     folder...) blocks every call: the guard cannot tell which agents are frozen.
//
// What is protected:
//   - A frozen agent's evals/**, docs/agent/design.md and docs/agent/spec.md.
//       - Edit, Write, MultiEdit and NotebookEdit are blocked on them (file_path, notebook_path).
//       - One exception, while the agent's build.md exists: the Test cells of the spec's
//         Traceability table, which the build fills with the guard on. An Edit, MultiEdit or
//         Write of docs/agent/spec.md passes when it changes nothing but Test cells: the spec is
//         read from disk, the call applied to it (old_string to new_string, replace_all honoured,
//         edits in order; Write's content is the new text), CRLF read as LF, and every changed
//         line must be a table row in the Traceability section (under the `## ` heading whose
//         text, a leading number like "5. " aside, is Traceability), outside code fences (a line
//         starting with ``` or ~~~ opens or closes one), whose first cell is BHV-NNN and whose
//         cells, trimmed, differ in the fourth only, a cell that holds no <!-- or --> before or
//         after; no line is added or removed, except that a Write may leave out or add the final
//         newline. Blocked on the spec: anything else, an old_string not found, a new_string with
//         a replacement pattern ($$, $&, $`, $' or $ and a digit), a MultiEdit of more than 1,000
//         edits, a call that would grow the text more than 1 MB past the spec's length, a spec
//         that cannot be read, a shell write and a NotebookEdit.
//   - A frozen agent's docs/agent/build.md, while it exists: deleting or moving it is blocked
//     (rm, del, Remove-Item, mv, Move-Item, git rm, git mv...); its content stays editable, with a
//     file tool or a shell write.
//   - .claude/hooks/** (this script and the ratchet), against file tools and shell writes alike.
//   - While an agent is frozen, the repository's .git internals that run commands or redirect git:
//     .git/hooks/**, .git/config, .git/info/** and .git/modules/**/config, against file tools and
//     shell writes alike; and git config entry points, whether set with `git config` (any scope)
//     or a `-c key=value`: alias.*, core.worktree/hooksPath/fsmonitor/pager/editor/sshCommand,
//     filter.*.smudge|clean|process, diff.external, diff.*.textconv, merge.*.driver, include.path
//     and includeIf.*. These are the owner's, from their own terminal.
//   - The settings: <repo>/.claude/settings.json, <repo>/.claude/settings.local.json and the
//     user's ~/.claude/settings.json. A file tool's call on one passes only when the file, with
//     the call applied, is a valid JSON object that keeps the guard's PreToolUse entry (each hook
//     that runs guard-artifacts.mjs, with its matcher, as it was), does not set disableAllHooks
//     and keeps the env key (in the user's file only PATH, NODE_OPTIONS and the other NODE_*
//     entries, which steer the guard's interpreter). Writing the guard's entry exactly as
//     templates/build/settings.json has it where there is none is allowed: that installs it. Any
//     shell write to one of the three files is blocked, and so is a NotebookEdit.
//   - Links: a file that is a hard link to a protected file (same device and inode) is protected
//     too; creating a link to or from a protected path or a folder that holds one (ln, link, cp -l
//     or -s, mklink, fsutil hardlink, New-Item -ItemType HardLink, SymbolicLink or Junction) is
//     blocked, a symbolic link's relative target read from the link's folder as well.
//   - Git, while any agent is frozen: apply, am, revert, cherry-pick, merge, pull, rebase, reset
//     --hard (and --keep, --merge), stash pop, apply and branch, checkout-index, filter-branch,
//     filter-repo, update-index --index-info, and checkout or restore from a tree-ish or
//     --source/-s whose pathspec is ., a : magic pathspec, a glob, or reaches a folder that holds
//     frozen paths or a frozen path, are the owner's. So are a checkout or restore with -p/--patch
//     or --pathspec-from-file; any git command with a --git-dir or --work-tree option or a
//     GIT_DIR, GIT_WORK_TREE or GIT_INDEX_FILE assignment; update-index --cacheinfo/--add whose
//     path reaches a frozen one; git clean with no path, and git clean or git stash with a : magic
//     pathspec (:/, :(top), :!src, :(exclude)src), which reach across the repository, where a
//     destructive verb may not reach (the repository root, a frozen agent root, docs...); and git
//     stash -u, -a, --include-untracked or --all, which is repo-wide, wherever it runs; and git
//     worktree add <dir>, git clone <repo> <dir>, git submodule add <url> <dir> and git init <dir>
//     whose destination is a frozen folder. `git -C <dir>` resolves from <dir>.
//   - A git command that moves HEAD, the branch or the index/worktree from another revision is
//     judged by comparing that revision with HEAD over the protected paths, not by a verb list:
//     checkout/switch (including -b/-B/-c/-C <name> <start>, <rev> --, the one-word form resolved
//     by `git rev-parse --verify -q <w>^{commit}` first as git does, - and @{-1}, and a DWIM
//     origin/<name>), reset --soft/--mixed, read-tree, update-ref, symbolic-ref HEAD, and branch
//     -f/-M/-C onto the current branch. `git diff --quiet HEAD <rev> -- <protected>` is run with a
//     short timeout; identical is open, a difference (or any git call that fails, so the tree
//     cannot be read) is the owner's. A checkout or restore from the index (checkout -- ., restore
//     .) is open unless the index differs from HEAD at a protected path (`git diff --cached
//     --quiet`). Open: git add, commit, diff, log, show, status, checkout -b/switch -c from HEAD,
//     checkout -- src/x, restore src/x, restore --staged (index only), reset, reset HEAD,
//     reset -- src/x, clean src, clean -n/--dry-run, and any of the above to a revision whose
//     protected paths equal HEAD's.
//   - Bash and PowerShell are blocked when a command redirects into a protected path, or runs a
//     write command on one: tee, touch, truncate, sed -i, git checkout, Set-Content, Out-File...;
//     cp, copy, Copy-Item, install, xcopy, robocopy, rsync, scp, and the destination of mv,
//     Move-Item...: the destination counts, and when it names a folder (a final / or \, . or ..,
//     -t or --target-directory, a folder on disk, several sources) so does <folder>/<name> for
//     each source, a glob as <folder>/*; a recursive copy (-r, -a, -Recurse) or a move counts as a
//     folder that holds protected paths there, and also at a destination it would create; a
//     content copy (xcopy, robocopy, rsync x/, cp x/.) at the destination itself; a PowerShell
//     copy or move with one operand lands in the folder in effect; an extraction (tar/bsdtar/jar
//     x, unzip, 7z/7za x, cpio -i, Expand-Archive) fills its destination — a -C/-d/-o/
//     --directory/-DestinationPath value, separate or attached (-Cevals), else the folder in
//     effect — so `cd evals && tar xf a.tar` and `tar xf a.tar` at a frozen root are caught; gawk
//     -i inplace rewrites the files it names; rm, del, Remove-Item, mv, move,
//     Move-Item, ren (a folder that holds a protected path counts: the repository root and every
//     folder above it, .claude, .claude/hooks, and for each frozen agent its root, docs,
//     docs/agent and evals, and agents/ and agents/<domain>/ above it; also . and *); a write
//     stage fed by a pipeline that named one (ls evals | xargs rm); an inline script (node -e,
//     python -c, a heredoc) that writes and names one. Reading passes.
//   - patch rewrites files in place: an explicit file operand is its target; otherwise the diff's
//     +++/--- target paths are read from a here-document, a pipe or a readable -i/< file. A target
//     that reaches a protected path is blocked; while an agent is frozen a patch whose targets
//     cannot be read is blocked too. --dry-run and --check only test, and pass.
//   - A shell, an eval verb or source/. that reads its script from a producer (a pipe, <<<,
//     <(...), $(...)) runs that output: an echo/printf of literal words is rescanned as a command,
//     and an opaque producer (base64 -d, curl, cat of a file, a variable) blocks while frozen. A
//     script file (bash build.sh) stays a documented limit.
//   - unlink and shred delete; a PowerShell .NET method on a path ((Get-Item evals).Delete(),
//     $f.MoveTo(...), [IO.File]::WriteAllText(...)) writes it; a PowerShell stage that runs
//     cmd/powershell has its quoted arguments scanned as commands (Start-Process cmd
//     -ArgumentList '/c del x'); and the piped item — xargs's {} or PowerShell's $_/$PSItem — in a
//     write (a copy destination, or any operand of a delete, move or content write) is the path
//     the pipeline fed, so a frozen source it names is caught.
//   - Anything else passes, and so does a path outside the repository or on another drive.
//
// Choices:
//   - The project is CLAUDE_PROJECT_DIR, else the payload's cwd, else the process cwd. The tree
//     being built is the project, except in an isolated worktree (the cwd is inside
//     <project>/.claude/worktrees/<name>, while Claude Code leaves CLAUDE_PROJECT_DIR on the main
//     checkout), where it is that worktree, and when the cwd is neither in nor above the project,
//     where it is the cwd itself. Both are guarded as repositories, each with its own agents and
//     ratchet. $CLAUDE_PROJECT_DIR is what the shell expands it to.
//   - Relative paths resolve from the payload's cwd (Claude Code's hook cwd follows `cd`), and
//     from the folders a cd/pushd/Set-Location on the same line moved to: the start folder and
//     the last 8 distinct ones; from a folder above a root they still lead into it. A bare
//     folder (*, ., ./*) means the folder in effect at its command, so `cd build && rm -rf *`
//     passes. When every cd on the line is a reliable `&&` of a literal folder the command runs
//     in the folder in effect for sure, so an explicit name is judged from there alone too (so
//     `cd agents/d/unbuilt && rm -rf evals` is not blocked from the root); once a `;` cd (that
//     might fail), a popd or a `cd -` makes the folder uncertain, an explicit name is checked from
//     all the remembered folders, and so is a bare folder. In Bash a ( ) group, $( ), a nested shell,
//     a here-document run by a shell and each side of a pipe leave their cds behind when they
//     end; in PowerShell only a nested shell does, since the location belongs to the session.
//   - It fails closed. Stdin that is not a JSON object cannot say what the call would change, so
//     the call is blocked instead of waved through; an internal error blocks too. A JSON object
//     with no usable tool or path fields passes: there is nothing to inspect.
//   - Paths compare case-insensitively, with / and \ alike; $PWD, $CLAUDE_PROJECT_DIR and ~ at the
//     start of a path are expanded; on Windows /c/x, /cygdrive/c/x and /mnt/c/x mean C:\x, for
//     CLAUDE_PROJECT_DIR and the cwd too, a leading \\?\ is dropped, and a path is read as Windows
//     opens it: a trailing ::$DATA and each part's trailing dots and spaces dropped (spec.md. is
//     spec.md). A file tool's path is also resolved through the file system (realpath) when the
//     file or its folder exists, so a junction, a symbolic link, an 8.3 short name or another case
//     leads where it points; on Windows a file tool's path with a : after the drive letter (an
//     NTFS stream), a UNC share (\\server\share) or a \\.\ or \\?\UNC\ device path is blocked as
//     unsafe, since realpath keeps its form. Shell paths are read as written.
//   - In Bash only the command position (after assignments, then/do, and wrappers such as sudo,
//     env, xargs, time, timeout, stdbuf, busybox, nice) names the write command, so prose in a
//     commit message is not one; eval and Invoke-Expression re-parse their arguments (and piped
//     input) as a command; PowerShell checks every word. Adjacent quoted and bare pieces join
//     into one word (e"val"s, ev''als are evals), and a Bash backslash escape is read away as a
//     second reading beside the path one (r\m is rm, ev\als is evals, while evals\x.json stays a
//     path). Here-document bodies are data unless a shell reads them (bash <<EOF, or a pipe into
//     a shell or an interpreter); each is read by its own stage only. A body runs from the line
//     after its command to the first line holding only its tag (an empty one closes on the next
//     line); a << in quotes or a comment, a <<< here-string and a (( )) shift open none, a $( )
//     inside double quotes is a command, one never closed is read as commands, and PowerShell has
//     none. The scan is linear in the command's length. Quoted bodies of bash -c,
//     cmd /c, powershell -Command and $( ) are scanned as commands. A line continued with a
//     backslash (Bash) or a backtick (PowerShell) is joined before it is cut into commands.
//   - An interpreter line counts as a write only for a call or API word (writeFileSync(,
//     os.rename(, os.link(, shutil, WriteAll*, Set-Content...), not for a --flag or a name that
//     holds one. One that removes or moves (unlink, rmSync, os.remove, shutil.rmtree,
//     Remove-Item, [IO.File]::Delete...) reaches a folder that holds protected paths and a frozen
//     agent's build.md, as a destructive shell command does; one that only creates or overwrites
//     reaches the frozen files alone, so build.md's content stays editable from a script too.
//   - Each call reads only what it needs: the ratchet, a build.md per agent root, the two levels
//     of agents/, and the protected files' identities only when a written file has a hard link.
//     The only child processes are the git commands (rev-parse, diff --quiet, symbolic-ref) that
//     compare a revision with HEAD, run only for a git command that moves a tree while frozen.
//
// A mechanical first layer, not the only one. It cannot see a script file that writes (python
// build.py, bash build.sh), a glob that hides the name (rm ev*/x), a path a variable, loop or
// Join-Path assembles at run time (a cd target too: cd $dir), find -exec, dd of=, curl -o,
// wget -O, iwr -OutFile or ditto. The other way, it is deliberately conservative where it cannot
// be sure: a `find ... -delete` in or above a frozen holder is blocked whatever its -name/-path
// filters (the guard does not match them against the protected names), so
// `find . -name '*.pyc' -delete` at the root is refused; narrow the find to a subfolder that holds
// no frozen path, or let the owner run it. Ship's git-diff audit over the build's commit range is
// the standing second layer for everything the guard cannot see.
//
// Re-entry ladder: docs/00-overview.md, section "Re-entry", in the agent-engineering repository.
// Re-entry and upgrades under the guard are the owner's, from their own terminal, never an
// agent's: 1) rename this script to guard-artifacts.mjs.off; 2) make the change (the re-opened
// artifact; for an upgrade, copy the plugin's template over this file and commit it alone as
// "agent-engineering: guard upgrade"); 3) when an agent's docs/agent/build.md is deleted or
// moved, remove its line from .claude/hooks/built-agents.txt (a moved agent's new prefix is
// recorded on the next call); 4) rename the script back, then probe it.
// Check by hand (expect exit code 2 once an agent is frozen):
//   echo '{"tool_name":"Edit","tool_input":{"file_path":"evals/config.json"}}' |
//     CLAUDE_PROJECT_DIR=$PWD node .claude/hooks/guard-artifacts.mjs

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { posix } from "node:path";

const GUARD_VERSION = "2.7.0";

const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
const SPEC_FILE = "docs/agent/spec.md";
const BUILD_FILE = "docs/agent/build.md";
const FROZEN_FILES = new Set(["docs/agent/design.md", SPEC_FILE]);
const AGENTS_DIR = "agents";
const HOOKS_DIR = ".claude/hooks";
const RATCHET_FILE = `${HOOKS_DIR}/built-agents.txt`;
// The settings files of a repository, and the user's under the home folder.
const SETTINGS_FILES = new Set([".claude/settings.json", ".claude/settings.local.json"]);
const USER_SETTINGS = ".claude/settings.json";
// The env entries of the user's settings that steer the guard's interpreter: PATH and NODE_*.
const USER_ENV = /^(?:path|node_.*)$/i;
// The guard's registration as templates/build/settings.json writes it: the one entry a settings
// file may gain where it has none. A hook whose command names the script is the guard's.
const GUARD_SCRIPT = "guard-artifacts.mjs";
const GUARD_MATCHER = "Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell";
const GUARD_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-artifacts.mjs"';
// A line of the ratchet: "." for the repository root, agents/<domain>/<bot>/ for another agent,
// each part any characters but / and control characters (spaces included), never . or .. alone.
const RATCHET_PART = String.raw`(?!\.\.?(?:/|$))[^/\u0000-\u001f\u007f]+`;
const RATCHET_LINE = new RegExp(String.raw`^(?:\.|agents/${RATCHET_PART}/${RATCHET_PART})/?$`, "i");
// The folders of a frozen agent that hold its frozen paths, below its root ("" is the root).
const HOLDER_PARTS = ["", "docs", "docs/agent", "evals"];
// The file tools that may fill the spec's Test column, and where that column sits in a row of
// its Traceability table: | BHV | Capability | Eval | Test |.
const TEST_COLUMN_TOOLS = new Set(["Edit", "MultiEdit", "Write"]);
const TEST_CELL = 3;
const BHV_ID = /^BHV-\d{3}$/;
const UNESCAPED_PIPE = /(?<!\\)\|/;
// The section that holds the table, as chain finds it: a level-two heading outside code fences,
// whose text, a leading number aside, is Traceability.
const TRACEABILITY = "Traceability";
const FENCE = /^\s*(```|~~~)/;
const SECTION_HEADING = /^##\s+(.*\S)\s*$/;
const SECTION_NUMBER = /^\d+\.\s+/;
// What a Test cell may not hold: an HTML comment's markers, which would hide text from chain.
const COMMENT_MARKER = /<!--|-->/;
// A replacement pattern ($$, $&, $`, $' or $ and a digit): a tool that applies new_string with
// String.prototype.replace would not write it as it reads.
const REPLACEMENT_PATTERN = /\$[$&`'\d]/;
// Bounds on the simulation of a call: the edits of a MultiEdit, and how far past the file's
// length the text may grow before the call is judged too large to be a Test-column fill.
const MAX_EDITS = 1000;
const MAX_GROWTH = 1024 * 1024;
// How many files the guard lists under the protected folders when it looks for a hard link.
const MAX_LISTED = 20_000;

// What a command does with its operands (lower case; shell aliases and cmd.exe names included).
const WRITES = new Set([
  "tee", "touch", "truncate", "tee-object", "set-content", "add-content", "clear-content",
  "out-file", "new-item", "sc", "ac", "clc", "ni",
]);
const COPIES = new Set([
  "cp", "copy", "copy-item", "cpi", "install", "xcopy", "robocopy", "rsync", "scp",
]);
// Copies that put a source folder's content in the destination, not the folder itself.
const CONTENT_COPIES = new Set(["xcopy", "robocopy"]);
// A copy of whole folders: cp -r, -R or -a, rsync -r or -a, scp -r; PowerShell's -Recurse.
const CP_RECURSIVE = /^(?:-[a-zA-Z]*[rRa][a-zA-Z]*|--recursive|--archive)$/;
const PS_RECURSE = /^-r(?:e(?:c(?:u(?:r(?:s(?:e)?)?)?)?)?)?$/i;
const DELETES = new Set([
  "rm", "rmdir", "del", "erase", "rd", "ri", "remove-item", "unlink", "shred",
]);
const MOVES = new Set(["mv", "move", "mi", "move-item", "ren", "rename", "rni", "rename-item"]);
const LINKS = new Set(["ln", "link", "mklink"]);
const IN_PLACE = new Set(["sed", "perl", "ruby"]); // with -i / --in-place
// English words as well as commands: they name a command only at the start of one.
const PLAIN_ENGLISH = new Set(["copy", "move", "ren", "rename", "install", "link"]);
// Words before a command that are not the command; commands that run what follows them.
const LEADERS = new Set(["then", "do", "else", "elif", "if", "while", "until", "!", "{"]);
const WRAPPERS = new Set([
  "sudo", "doas", "env", "command", "nohup", "exec", "xargs", "nice", "ionice", "time", "builtin",
  "busybox", "timeout", "stdbuf", "setsid", "chrt", "setarch",
]);
// Words whose arguments are a command in their own right, re-parsed (eval rm, iex "rm x").
const EVAL_VERBS = new Set(["eval", "iex", "invoke-expression"]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "cmd", "pwsh", "powershell"]);
const INTERPRETER = /^(?:node(?:js)?|deno|bun|py|python[\d.]*|perl|ruby|php|pwsh|powershell)$/;
// The commands that matter in a word-by-word scan (PowerShell, or after a wrapper).
const KNOWN = new Set([
  ...WRITES, ...COPIES, ...DELETES, ...MOVES, ...LINKS, ...IN_PLACE, ...SHELLS, ...WRAPPERS,
  ...EVAL_VERBS, "find", "git", "fsutil", "tar", "unzip", "expand-archive", "awk", "gawk",
]);
// New-Item's -ItemType, as PowerShell lets it be shortened, and the item types that are links.
const ITEM_TYPE = /^-(?:it|ite|item|itemt|itemty|itemtyp|itemtype|type)$/i;
const LINK_TYPE = /^(?:hardlink|symboliclink|junction)$/i;
// cp's flags that make links instead of copies: -l, -s and their long names.
const CP_LINK = /^(?:-[a-zA-Z]*[ls][a-zA-Z]*|--link|--symbolic-link)$/;
// git: the global options that take a value; the verbs that rewrite the working tree from another
// commit; the resets that do; the stash actions, and those that write the stash back.
const GIT_VALUE_OPTIONS = new Set([
  "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env",
]);
const GIT_TREE_VERBS = new Set(["apply", "am", "revert", "cherry-pick", "merge", "pull", "rebase"]);
// Subcommands that rewrite the working tree or history whole, the owner's while an agent is frozen.
const GIT_OWNER_VERBS = new Set(["checkout-index", "filter-branch", "filter-repo"]);
// git config keys (via `git config` or `-c`) that run a command or point git at another tree/hook:
// aliases, the core.* that name a program or move the tree, filter/diff/merge programs, includes.
const GIT_CONFIG_OWNED = new RegExp(
  [
    String.raw`alias\.`,
    String.raw`core\.(?:worktree|hookspath|fsmonitor|pager|editor|sshcommand|askpass|` +
      String.raw`fsmonitorhookversion)$`,
    String.raw`filter\..+\.(?:smudge|clean|process)$`,
    String.raw`diff\.(?:external$|.+\.(?:textconv|command)$)`,
    String.raw`merge\..+\.driver$`,
    String.raw`(?:include\.path|includeif\.)`,
    String.raw`sequence\.editor$`,
    String.raw`uploadpack\.packobjectshook$`,
  ].join("|"),
  "i",
);
// The .git internals a write must not touch: its hooks, config, info and a submodule's config.
const GITDIR_PROTECTED = /(?:^|\/)\.git\/(?:hooks\/|config$|info\/|modules\/.+\/config$)/i;
const GIT_HARD_RESET = /^--(?:hard|keep|merge)$/;
// A reset or checkout flag that rewrites files from another tree without a pathspec the guard sees:
// -p/--patch applies hunks, --pathspec-from-file reads the paths from a file.
const GIT_BLIND_FLAG = /^(?:-p|--patch|--pathspec-from-file)(?:=|$)/;
const STASH_ACTIONS = new Set([
  "push", "save", "pop", "apply", "branch", "drop", "list", "show", "clear", "create", "store",
]);
const STASH_RESTORES = new Set(["pop", "apply", "branch"]);
const STASH_UNTRACKED = /^(?:--include-untracked|--all|-[a-zA-Z]*[ua][a-zA-Z]*)$/;
// A pathspec that is not a plain path: git's : magic, or a glob, which git matches across folders.
const PATHSPEC_MAGIC = /^:|[*?[]/;
// What an interpreter's command line or heredoc writes with, whatever the language. A name
// counts only as a call or a bare API word, not inside a --flag or a file name (--rename-cases,
// evals/truncate.json); stdout.write and stderr.write print.
const SCRIPT_WRITE = new RegExp(
  [
    // fs.writeFileSync(, os.rename(, Deno.writeTextFile(, fs.promises.unlink(
    String.raw`(?<![\w-])(?:writeFile|appendFile|copyFile|writeTextFile|unlink|rename|truncate)` +
      String.raw`\w*\s*\(`,
    String.raw`(?<![\w-])(?:createWriteStream|rmSync|rmdirSync|cpSync|write_text|write_bytes)\b`,
    String.raw`(?<![\w-])(?:WriteAll\w+|FileUtils|shutil)\b`,
    String.raw`(?<!stdout|stderr)\.(?:write|rm|cp)\(`,
    String.raw`(?<![\w-])os\.(?:remove|unlink|rename|replace|rmdir)\b`,
    String.raw`(?<![\w-])open\([^)]*,\s*(?:mode\s*=\s*)?['"][wax]`,
    // links: os.link(, fs.symlinkSync(, Path.hardlink_to
    String.raw`(?<![\w-])(?:sym)?link(?:Sync)?\s*\(`,
    String.raw`(?<![\w-])(?:hardlink_to|symlink_to)\b`,
    // perl: unlink "x", rename "a", "b"
    String.raw`(?<![\w./-])(?:unlink|rename)\s+["'$]`,
    // a shell command started from the script: os.system("rm x"), execSync("cp a b"), run(["mv"
    String.raw`(?:system|exec\w*|spawn\w*|popen|run|call|check_\w+)\s*\(\s*\[?\s*["']` +
      String.raw`(?:rm|mv|cp|tee|touch|truncate|del|ln)\b`,
    // PowerShell cmdlets
    String.raw`(?<![\w./-])(?:set-content|add-content|out-file|remove-item|move-item|copy-item|` +
      String.raw`new-item)(?![\w./-])`,
  ].join("|"),
  "i",
);
// What PowerShell can also write with: .NET static calls and instance methods on a path object
// (e.g. (Get-Item evals).Delete($true), $f.MoveTo('x'), [IO.File]::WriteAllText(...)).
const DOTNET_WRITE = new RegExp(
  [
    String.raw`\bWriteAll\w+`,
    String.raw`\b(?:File|Directory)\]::(?:Write|Append|Delete|Move|Copy|Create|Replace|Open)\w*`,
    String.raw`\.(?:Delete|MoveTo|CopyTo|Replace|Create|CreateText|AppendText|WriteAll\w+|` +
      String.raw`OpenWrite|Encrypt)\s*\(`,
    "StreamWriter|FileStream",
  ].join("|"),
  "i",
);
// The write APIs that remove or move, whatever the language: a path they name is judged as a
// folder that may hold protected paths and against the build-record rule, not only as a frozen
// file. The rest (writeFile, Set-Content, [IO.File]::WriteAllText) only create or overwrite.
const SCRIPT_DESTRUCTIVE = new RegExp(
  [
    String.raw`(?<![\w-])(?:unlink|rename|rmdir|rmtree|remove|move|replace)\w*\s*\(`,
    String.raw`(?<![\w-])(?:rmSync|rmdirSync|rm)\s*\(`,
    String.raw`(?<!stdout|stderr)\.rm\(`,
    String.raw`(?<![\w-])os\.(?:remove|unlink|rename|replace|rmdir)\b`,
    String.raw`(?<![\w-])shutil\.(?:rmtree|move)\b`,
    String.raw`(?<![\w./-])(?:unlink|rename)\s+["'$]`,
    String.raw`(?:system|exec\w*|spawn\w*|popen|run|call|check_\w+)\s*\(\s*\[?\s*["']` +
      String.raw`(?:rm|mv|del)\b`,
    String.raw`(?<![\w./-])(?:remove-item|move-item)(?![\w./-])`,
    String.raw`\b(?:File|Directory)\]::(?:Delete|Move)\w*`,
    String.raw`\.(?:Delete|MoveTo|Replace)\s*\(`,
  ].join("|"),
  "i",
);
// Archive tools that extract into a destination folder, filling it. With no destination flag the
// folder in effect is the destination.
const EXTRACTORS = new Set([
  "tar", "bsdtar", "unzip", "expand-archive", "7z", "7za", "7zr", "cpio", "jar",
]);
// An extraction mode: tar/bsdtar/jar x (xf, -x, --extract), 7z/cpio by their own mode flags; unzip
// and Expand-Archive always extract.
const TAR_EXTRACT = /^(?:--extract$|-?[a-z]*x[a-z]*$)/i;

// A quoted text, and the words of a command: a quoted text is one word, so a path with spaces
// in it stays whole. Words end at blanks, quotes and shell punctuation (= splits --path=x).
const QUOTED = /"([^"]*)"|'([^']*)'/g;
// A piece of a word: a double- or single-quoted run, or a bare run (sticky, so the scan tells an
// adjacent piece from a separated one). Adjacent pieces — no blank or punctuation between them —
// are one word, so e"val"s, ev''als and r\m each read as one.
const PIECE = /"([^"]*)"|'([^']*)'|([^\s"'`;|&()<>=,]+)/y;
const SEPARATOR = /[\s"'`;|&()<>=,]/;
// Loose words, for scanning a script: split on every quote and punctuation mark.
const LOOSE = /[\s"'`;|&()<>=,]+/;
// A redirection and its target: > file, >> file, 2> file, &> file, >&file; quoted text is skipped.
const REDIRECT = /"[^"]*"|'[^']*'|>>?&?\s*(?:"([^"]*)"|'([^']*)'|([^\s"'|&;<>()]+))/g;
const ASSIGNMENT = /^\s*(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|[^\s"']*)\s+)*/;
// A here-document's operator and tag (<<TAG, <<-TAG, <<'TAG', <<"TAG"), read where a scan of the
// line finds <<; and a line that can close one: its tag alone, spaces and tabs around it.
const HEREDOC_OPERATOR = /<<-?[ \t]*(['"]?)(\w+)\1/y;
const HEREDOC_CLOSER = /^[ \t]*(\w+)[ \t]*\r?$/;
// Command substitutions, $( ) and backticks; the first level of nesting is read.
const SUBSTITUTION = /\$\(((?:[^()]|\([^()]*\))*)\)|`([^`]*)`/g;
const GROUP = /\$?\(([^()]*)\)/g;
// A bare folder: nothing, ".", "./", "*", "./*" - the folder in effect, not a name.
const BARE = /^(?:\.\/?)?\*?$/;
const DESTINATION_FLAG = /^(?:-destination|-dest|-t|--target-directory)$/i;
const SHELL_FLAG = /^(?:-[a-z]*c|\/[ck]|-command)$/i;
// A /y-style option of cmd.exe commands, and what a piped write stage ignores as "no path".
const CMD_OPTION = /^\/[a-z?]$/i;
const NO_PATH = /^(?:[{}%]+|\d+|\$_.*|\$psitem.*|foreach(?:-object)?)$/i;
// A placeholder for the item a pipeline feeds: xargs's {} and PowerShell's $_ / $PSItem.
const PIPED_ITEM = /^(?:\{\}|\$_|\$psitem)/i;
// $PWD, $CLAUDE_PROJECT_DIR, $HOME, $env:NAME and ~ at the start of a path.
const VARIABLE = new RegExp(
  String.raw`^(?:\$\{?(pwd|claude_project_dir|home)\}?|` +
    String.raw`\$env:(pwd|claude_project_dir|home|userprofile)|~)(?=[\\/]|$)`,
  "i",
);
const GIT_BASH_DRIVE = /^\/(?:(?:cygdrive|mnt)\/)?([a-z])(?=\/|$)/i;
// A device prefix before a drive or a UNC share: \\?\C:\x, \\.\C:\x, \\?\UNC\server\share.
const DEVICE_PREFIX = /^[\\/]{2}[?.][\\/](?:(unc)[\\/]|(?=[a-z]:))/i;
// A win32 file-tool path the guard will not follow: a UNC share (\\server\share, \\localhost\c$),
// a \\?\UNC\ path, or a \\.\ device. A \\?\C:\ or //?/C:/ (device prefix before a drive) is not
// one: it is canonicalised. realpath keeps the UNC form, so these cannot be resolved safely.
const DEVICE_OR_UNC = /^[\\/]{2}(?:[.][\\/]|[?][\\/]unc(?=[\\/])|(?![.?][\\/]))/i;
const MAX_DEPTH = 4;
const MAX_CD = 8; // folders remembered from the line's cd commands, besides the starting one
const MAX_PATH = 4096; // the longest folder path a cd can reach

const PREFIX = "BLOCKED by the agent-engineering anti-gaming guard: ";
const LADDER =
  "Changes go through re-entry (dispute -> re-open the owning phase), never through the builder: " +
  "name the case or behavior, the two readings and the evidence, and let the owner route it. " +
  "The one sanctioned edit is the spec's Test column, made with the guard on: an Edit, " +
  "MultiEdit or Write of docs/agent/spec.md that changes only Test cells of its Traceability " +
  "table (the fourth cell of a BHV-NNN row in the Traceability section, outside code fences; " +
  "no <!-- or --> in the cell, no $&-style pattern in a new_string) passes, and then " +
  "git diff -- docs/agent/spec.md must show nothing else. A re-opened phase asks the owner to " +
  "rename the guard off and back with their own shell; never rename it yourself.";
const OWNER_STEPS =
  "The owner does it from their own terminal: rename .claude/hooks/guard-artifacts.mjs to " +
  "guard-artifacts.mjs.off, make the change, remove the agent's line from " +
  ".claude/hooks/built-agents.txt when its docs/agent/build.md is deleted or moved, and rename " +
  "the guard back.";
const HOOKS_RULE =
  "The folder holds the guard, installed from the plugin template " +
  "(templates/build/guard-artifacts.mjs) and never edited in place, and its ratchet " +
  "(built-agents.txt), which the guard keeps itself. Install the guard by copying the template " +
  "with a shell copy before the hook is active; an upgrade or a change to the ratchet is the " +
  "owner's, from their own terminal: they rename the guard to guard-artifacts.mjs.off, make " +
  "the change and rename it back. The spec's Test column needs no switching off: the guard lets " +
  "an edit of only the Test cells of its Traceability table through. Re-entry under the guard " +
  "is the owner's too: the owning phase asks them to rename it off and back with their own " +
  "shell, then probes it.";
const GITDIR_RULE =
  "The repository's .git internals — its hooks (.git/hooks/**), config (.git/config), info " +
  "(.git/info/**) and a submodule's config (.git/modules/**/config) — run commands or redirect " +
  "git, so no tool call may write them while an agent is frozen. A change there is the owner's, " +
  "from their own terminal.";
const SETTINGS_RULE =
  "The guard's PreToolUse entry, disableAllHooks and the env key of the settings files (the " +
  "repository's .claude/settings.json and .claude/settings.local.json, and the user's " +
  "~/.claude/settings.json, where only PATH, NODE_OPTIONS and the other NODE_* entries of env " +
  "count) are the owner's, changed from their own terminal. Any other setting may change with a " +
  "file tool (Edit, MultiEdit or Write), and installing the guard's entry as " +
  "templates/build/settings.json writes it, where there is none, is allowed.";
const GIT_RULE =
  "While an agent of this repository is frozen (its docs/agent/build.md exists or " +
  ".claude/hooks/built-agents.txt lists it), the git verbs that can rewrite frozen files from " +
  "another commit are the owner's, run from their own terminal: apply, am, revert, cherry-pick, " +
  "merge, pull, rebase, reset --hard, stash pop, apply and branch, checkout or restore from " +
  "another commit over ., a : pathspec, a glob, a folder that holds frozen paths or a frozen " +
  "path, and clean or stash -u with no path where a destructive command may not reach. git " +
  "add, commit, diff, log, show, status, switch, checkout <branch>, checkout -b and checkout " +
  "or restore of other paths stay open.";
const MALFORMED =
  PREFIX +
  "stdin is not a JSON tool call, so the guard cannot tell what the call would change and fails " +
  "closed. Claude Code pipes { tool_name, tool_input } to this hook; run it only as a PreToolUse " +
  "hook (see the header of .claude/hooks/guard-artifacts.mjs).";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const slashes = (text) => text.replaceAll("\\", "/");
const unique = (list) => [...new Set(list.filter((item) => typeof item === "string"))];
/** `part` below `base`, either of which may be "" (the folder itself). */
const joined = (base, part) => (base === "" ? part : part === "" ? base : `${base}/${part}`);
/** A path without a leading \\?\ or \\.\ before a drive; \\?\UNC\server\share is //server/share. */
const stripDevice = (path) => path.replace(DEVICE_PREFIX, (_, unc) => (unc ? "//" : ""));

/**
 * Forward slashes, no trailing slash, case kept (lower-cased where paths are compared); on
 * Windows a Git Bash /c/x is c:/x.
 */
function tidy(path) {
  const clean = posix.normalize(slashes(stripDevice(path))).replace(/\/+$/, "");
  return process.platform === "win32" ? clean.replace(GIT_BASH_DRIVE, "$1:") : clean;
}

/** A failure to read the ratchet: the guard cannot tell which agents are frozen. */
class Unreadable extends Error {}

// --- Paths ---------------------------------------------------------------------------------
// A context says where the call runs: `roots` are the repositories being guarded (the tree being
// built, and the project $CLAUDE_PROJECT_DIR stands for in a shell, when they differ), `dir` is
// the folder in effect at the command being read and `dirs` the folders a path is checked from
// (the first, then the last few cd targets), all as spelled. `unsure` says that a popd or `cd -`
// has left the folder in effect unknown, so it is any of `dirs`.

/** The rest of `full` below `base` ("" for `base` itself), or null when it is outside. */
function below(base, full) {
  if (full === base) return "";
  return full.startsWith(`${base}/`) ? full.slice(base.length + 1) : null;
}

/** `$PWD/x`, `$CLAUDE_PROJECT_DIR/x`, `~/x` and their PowerShell and braced spellings. */
function expand(raw, dir, ctx) {
  return raw.replace(VARIABLE, (_, shell, windows) => {
    const name = (shell ?? windows ?? "~").toLowerCase();
    return name === "pwd" ? dir : name === "claude_project_dir" ? ctx.project : homedir();
  });
}

/**
 * A path as Windows opens it: a trailing ::$DATA (the file's own content) dropped, and each part's
 * trailing dots and spaces, so `spec.md.` and `spec.md::$DATA` are spec.md. A part that is only
 * dots or spaces (`.`, `..`, `...`) is left as it is.
 */
const windowsName = (path) =>
  path
    .replace(/::\$data$/i, "")
    .split("/")
    .map((part) => part.replace(/[. ]+$/, "") || part)
    .join("/");

/** The absolute path (forward slashes, case kept) that `raw` names when run from `dir`. */
function resolveCased(raw, dir, ctx) {
  let path = slashes(stripDevice(expand(raw.trim(), dir, ctx)));
  if (process.platform === "win32") path = windowsName(path);
  if (ctx.drives) path = path.replace(GIT_BASH_DRIVE, "$1:");
  const absolute = path.startsWith("/") || /^[a-z]:\//i.test(path);
  const full = absolute ? path : `${dir}/${path}`;
  // The drive is set aside so that .. at the top of a drive stays there, as it does in a shell.
  const drive = /^[a-z]:(?=\/|$)/i.exec(full)?.[0] ?? "";
  return drive + posix.normalize(full.slice(drive.length) || "/").replace(/\/+$/, "");
}

/** The absolute path, lower case and forward slashes, that `raw` names when run from `dir`. */
const resolvePath = (raw, dir, ctx) => resolveCased(raw, dir, ctx).toLowerCase();

/** `path` as the file system spells it, links, junctions and 8.3 names followed; null if absent. */
function realPath(path) {
  try {
    return tidy(realpathSync.native(path));
  } catch {
    return null;
  }
}

/**
 * The real path of `path`, or of its folder with its name kept when the file does not exist yet;
 * null when neither exists.
 */
function canonical(path) {
  const own = realPath(path);
  if (own !== null) return own;
  const at = path.lastIndexOf("/");
  if (at < 0) return null;
  const folder = path.slice(0, at);
  const parent = realPath(folder === "" || /^[a-z]:$/i.test(folder) ? `${folder}/` : folder);
  return parent === null ? null : `${parent.replace(/\/$/, "")}/${path.slice(at + 1)}`;
}

/** The place of `full` in a repository: the rest below one of its spellings, or null. */
function relIn(root, full) {
  for (const key of root.keys) {
    const rel = below(key, full);
    if (rel !== null) return rel;
  }
  return null;
}

/** Whether a path written as `raw` can be protected from `dir`; the cheap answers come first. */
function worthResolving(raw, dir, ctx) {
  // Absolute, expanded (~, $PWD) or climbing paths need the full resolution.
  if (/^(?:[/~$]|[a-z]:)|\.\./i.test(slashes(raw.trim()))) return true;
  const low = dir.toLowerCase();
  return ctx.roots.some((root) =>
    root.keys.some((key) => {
      // From the root or a folder above it, a name can lead into the root.
      if (below(low, key) !== null) return true;
      // From below it, a name stays below `dir`: protected only from these folders.
      const inside = below(key, low);
      return inside !== null && /^(?:evals|docs|agents|\.claude|\.git)?(?:\/|$)/.test(inside);
    }),
  );
}

/**
 * What protects the resolved path `full`, or undefined: `hooks` (.claude/hooks/**), `settings`
 * (with the file to read, and `user` for ~/.claude/settings.json), `frozen` (a frozen agent's
 * evals, design or spec; `spec` is the spec to read when the Test-column exception may apply) or
 * `build` (a frozen agent's build.md, which may not be deleted or moved). With `holders`, a call
 * that deletes or moves: a folder that holds a protected path counts too, and so does build.md.
 */
function classifyFull(full, ctx, holders) {
  for (const root of ctx.roots) {
    const rel = relIn(root, full);
    if (rel === null) {
      // Above the root: deleting the folder, or what `*` matches in it, takes the root along.
      const folder = full.replace(/\/\*$/, "");
      const above = root.keys.some((key) => below(folder, key) !== null);
      if (holders && above) return { rule: "frozen" };
      continue;
    }
    if (rel === HOOKS_DIR || rel.startsWith(`${HOOKS_DIR}/`)) return { rule: "hooks" };
    // .git internals matter only once an agent is frozen (a hook or config could then rewrite a
    // frozen file on a later git call); a fresh repository's .git setup stays open.
    if (ctx.anyFrozen && GITDIR_PROTECTED.test(rel)) return { rule: "gitdir" };
    if (SETTINGS_FILES.has(rel)) return { rule: "settings", file: `${root.cased}/${rel}` };
    if (holders && root.holders.has(rel)) {
      return { rule: rel === ".claude" || rel === ".claude/*" ? "hooks" : "frozen" };
    }
    const agent = root.agents.find(
      (one) => one.prefix === "" || rel === one.prefix || rel.startsWith(`${one.prefix}/`),
    );
    // The path below its agent root ("" for the root itself).
    const sub =
      agent.prefix === "" ? rel : rel === agent.prefix ? "" : rel.slice(agent.prefix.length + 1);
    if (agent.frozen && (sub === "evals" || sub.startsWith("evals/") || FROZEN_FILES.has(sub))) {
      // The Test-column exception holds while the build record exists.
      const fillable = sub === SPEC_FILE && agent.built;
      const spec = fillable ? `${root.cased}/${joined(agent.cased, sub)}` : null;
      return { rule: "frozen", spec };
    }
    if (holders && agent.built && sub === BUILD_FILE) return { rule: "build" };
  }
  if (ctx.userSettings.includes(full)) return { rule: "settings", file: ctx.userFile, user: true };
  return undefined;
}

/**
 * What protects `raw`, from the starting folder and from the folders a cd moved to. A bare folder
 * (`*`, `.`, `./*`) means the folder in effect, and only that one counts, unless a popd or `cd -`
 * has left it unknown. When every cd on the line was a reliable `&&` of a literal folder the
 * command runs in `ctx.dir` for sure, so an explicit name is judged from there alone too; a `;`
 * cd that might have failed keeps the earlier folders in play.
 */
function classify(raw, ctx, { holders = false } = {}) {
  if (raw.trim() === "") return undefined;
  // In Bash a backslash escapes the next character, so ev\als is also read as evals; the written
  // reading (backslash as a path separator) is kept too. Single quotes are honoured by the words
  // that built `raw`; here it is one reading beside the written one.
  const forms =
    ctx.tool !== "PowerShell" && raw.includes("\\") ? unique([raw, deEscape(raw)]) : [raw];
  const reliable = ctx.chainReliable && !ctx.unsure;
  for (const form of forms) {
    const bare = holders && !ctx.unsure && BARE.test(slashes(form.trim()));
    for (const dir of bare || reliable ? [ctx.dir] : ctx.dirs) {
      if (!worthResolving(form, dir, ctx)) continue;
      const found = classifyFull(resolvePath(form, dir, ctx), ctx, holders);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** A shell hit on `raw`: what protects it, if anything. */
function hitOn(raw, ctx, options) {
  const found = classify(raw, ctx, options);
  return found === undefined ? undefined : { rule: found.rule, raw };
}

/** The first result of `read` over `list` that is not undefined, reading no further. */
function firstOf(list, read) {
  for (const item of list) {
    const found = read(item);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * The tree being built: the project, except that in an isolated worktree under
 * <project>/.claude/worktrees/<name> it is that worktree, and that a working directory neither in
 * nor above the project is the tree itself. Paths keep their spelling.
 */
function buildRoot(project, cwd) {
  const inside = below(project.toLowerCase(), cwd.toLowerCase());
  if (inside === null) {
    return below(cwd.toLowerCase(), project.toLowerCase()) === null ? cwd : project;
  }
  if (!/^\.claude\/worktrees\/[^/]+/.test(inside)) return project;
  // Lower case never adds a "/", so the cwd's parts line up with the project's.
  return cwd.split("/").slice(0, project.split("/").length + 3).join("/");
}

/**
 * `path` as the file system spells it: itself, or one of the cwd's or the project's spellings or
 * of their parents' whose whole lower case is the same, the first that exists. Lower case may
 * change a name's length ("İ" becomes two characters), so it is never cut by one.
 */
function spelled(path, cased) {
  const low = path.toLowerCase();
  const candidates = [path];
  for (const one of cased) {
    const parts = one.split("/");
    for (let n = parts.length; n > 0; n--) candidates.push(parts.slice(0, n).join("/"));
  }
  return candidates.find((one) => one.toLowerCase() === low && existsSync(one)) ?? path;
}

// --- Agents and the ratchet ------------------------------------------------------------------

/** The folders in `path`, as spelled on disk; none when it cannot be listed. */
function folders(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * The ratchet's text and the prefixes it lists (lower case, mapped to their spelling); a missing
 * file lists none. A file that exists but cannot be read, or is not UTF-8, throws Unreadable.
 */
function readRatchet(path) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    const missing = error?.code === "ENOENT" || error?.code === "ENOTDIR";
    if (missing) return { text: null, listed: new Map() };
    throw new Unreadable(`${error?.code ?? error}`);
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Unreadable("not UTF-8");
  }
  const listed = new Map();
  for (const line of text.replace(/^\u{FEFF}/u, "").split(/\r?\n/)) {
    // The line as written, and without the spaces around it: a folder name may hold spaces.
    for (const entry of unique([slashes(line), slashes(line.replace(/^[ \t]+|[ \t]+$/g, ""))])) {
      if (!RATCHET_LINE.test(entry)) continue;
      const cased = entry === "." || entry === "./" ? "" : entry.replace(/\/$/, "");
      if (!listed.has(cased.toLowerCase())) listed.set(cased.toLowerCase(), cased);
    }
  }
  return { text, listed };
}

/**
 * Appends the agents built and not yet listed to the ratchet, through a temporary file renamed
 * over it. A failure is left alone: the call is judged from what was read and what is on disk.
 */
function record(root, text, missing) {
  const newline = text?.includes("\r\n") ? "\r\n" : "\n";
  const head = text === null ? "" : text === "" || text.endsWith("\n") ? text : `${text}${newline}`;
  const lines = missing.map((cased) => (cased === "" ? "." : `${cased}/`));
  const temporary = `${root.ratchet}.${process.pid}.tmp`;
  try {
    mkdirSync(`${root.cased}/${HOOKS_DIR}`, { recursive: true });
    writeFileSync(temporary, head + lines.map((line) => line + newline).join(""));
    renameSync(temporary, root.ratchet);
  } catch {
    try {
      unlinkSync(temporary);
    } catch {
      // Nothing was left behind.
    }
  }
}

/**
 * A repository being guarded: its spellings (`keys`, lower case: as given and its real path), its
 * spelling for reading files, its agents (deepest first; each with its prefix, its spelling, and
 * whether it is built and frozen) and the folders a deleting or moving command may not take.
 */
function repository(path, cased) {
  const spelling = spelled(path, cased);
  const real = realPath(spelling);
  const root = {
    keys: unique([path.toLowerCase(), spelling.toLowerCase(), real?.toLowerCase()]),
    cased: spelling,
    ratchet: `${spelling}/${RATCHET_FILE}`,
    agents: [],
    holders: new Set(["", ".claude", HOOKS_DIR]),
  };
  const { text, listed } = readRatchet(root.ratchet);
  const found = new Map([["", ""]]);
  for (const domain of folders(`${spelling}/${AGENTS_DIR}`)) {
    for (const bot of folders(`${spelling}/${AGENTS_DIR}/${domain}`)) {
      const prefix = `${AGENTS_DIR}/${domain}/${bot}`;
      if (!found.has(prefix.toLowerCase())) found.set(prefix.toLowerCase(), prefix);
    }
  }
  for (const [prefix, spelt] of listed) if (!found.has(prefix)) found.set(prefix, spelt);
  const missing = [];
  for (const [prefix, spelt] of found) {
    const built = existsSync(`${spelling}/${joined(spelt, BUILD_FILE)}`);
    root.agents.push({ prefix, cased: spelt, built, frozen: built || listed.has(prefix) });
    if (built && !listed.has(prefix)) missing.push(spelt);
  }
  root.agents.sort((a, b) => b.prefix.length - a.prefix.length);
  // A folder name the ratchet cannot hold (a control character) is not recorded, so that the
  // file does not grow on every call; that agent stays frozen while its build.md exists.
  const recordable = missing.filter((cased) => cased === "" || RATCHET_LINE.test(`${cased}/`));
  if (recordable.length > 0) record(root, text, recordable.sort());
  for (const agent of root.agents) {
    if (!agent.frozen) continue;
    for (const part of HOLDER_PARTS) root.holders.add(joined(agent.prefix, part));
    if (agent.prefix !== "") {
      root.holders.add(AGENTS_DIR);
      root.holders.add(agent.prefix.split("/").slice(0, 2).join("/"));
    }
  }
  for (const holder of [...root.holders]) root.holders.add(joined(holder, "*"));
  return root;
}

// --- Hard links -------------------------------------------------------------------------------

/**
 * The identity (device and inode) of every protected file, with its name: .claude/hooks/**, the
 * settings files, and each frozen agent's evals/**, design and spec. Listed once per call, and
 * only when a written file turns out to have more than one name.
 */
function protectedFiles(ctx) {
  if (ctx.protectedFiles !== undefined) return ctx.protectedFiles;
  const files = [];
  let budget = MAX_LISTED;
  const add = (path, name) => {
    const info = identity(path);
    if (info !== undefined) files.push({ ...info, path, name });
  };
  const walk = (folder, name) => {
    let entries = [];
    try {
      entries = readdirSync(folder, { recursive: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (budget-- <= 0) {
        ctx.overflow = true;
        return;
      }
      const rel = slashes(String(entry));
      add(`${folder}/${rel}`, `${name}/${rel}`);
    }
  };
  for (const root of ctx.roots) {
    walk(`${root.cased}/${HOOKS_DIR}`, HOOKS_DIR);
    for (const file of SETTINGS_FILES) add(`${root.cased}/${file}`, file);
    for (const agent of root.agents) {
      if (!agent.frozen) continue;
      const evals = joined(agent.cased, "evals");
      walk(`${root.cased}/${evals}`, evals);
      for (const file of FROZEN_FILES) {
        add(`${root.cased}/${joined(agent.cased, file)}`, joined(agent.cased, file));
      }
    }
  }
  add(ctx.userFile, `~/${USER_SETTINGS}`);
  ctx.protectedFiles = files;
  return files;
}

/** A file's device and inode, and how many names it has; undefined for a folder or no file. */
function identity(path) {
  try {
    const info = statSync(path, { bigint: true, throwIfNoEntry: false });
    if (info === undefined || !info.isFile()) return undefined;
    return { dev: info.dev, ino: info.ino, links: info.nlink };
  } catch {
    return undefined;
  }
}

/**
 * The protected file that `path` is another name for, when it is a hard link to one: its name.
 * The protected file itself is not another name for itself.
 */
function hardLinked(path, ctx) {
  const info = identity(path);
  if (info === undefined || info.links < 2n || info.ino === 0n) return undefined;
  const own = (canonical(path) ?? path).toLowerCase();
  for (const file of protectedFiles(ctx)) {
    if (file.dev !== info.dev || file.ino !== info.ino) continue;
    if ((canonical(file.path) ?? file.path).toLowerCase() !== own) return file.name;
  }
  // Too many files to list them all: a file with several names may be one of the others.
  return ctx.overflow ? "a protected file (too many to list)" : undefined;
}

/** A shell write's hit through a hard link: the protected file `raw` is another name for. */
function linkHit(raw, ctx) {
  if (raw.trim() === "") return undefined;
  for (const dir of ctx.dirs) {
    const target = hardLinked(resolveCased(raw, dir, ctx), ctx);
    if (target !== undefined) return { rule: "hardlink", raw, target };
  }
  return undefined;
}

/** What a command that writes into `raw` would change: a protected path, or one through a link. */
const writeHit = (raw, ctx) => hitOn(raw, ctx) ?? linkHit(raw, ctx);

// --- Shell commands -------------------------------------------------------------------------

/**
 * The words of a command. Adjacent pieces join into one word, a quoted run contributing its inner
 * text, so e"val"s, ev''als and r\m each stay whole; a blank or a punctuation mark ends a word.
 * PowerShell's -Path:value splits on the colon.
 */
function words(text) {
  const found = [];
  let word = null; // the pieces of the word being read, or null between words
  PIECE.lastIndex = 0;
  for (let i = 0; i < text.length; ) {
    PIECE.lastIndex = i;
    const m = PIECE.exec(text);
    if (m !== null && m.index === i) {
      (word ??= []).push(m[1] ?? m[2] ?? m[3]);
      i = PIECE.lastIndex;
      continue;
    }
    if (word !== null) {
      found.push(word.join(""));
      word = null;
    }
    i++; // a separator between words, skipped
  }
  if (word !== null) found.push(word.join(""));
  // PowerShell's -Path:value
  return found.flatMap((one) => /^(-\w+):(.+)$/.exec(one)?.slice(1) ?? [one]);
}

/**
 * A word with its Bash backslash escapes removed (\x is x), outside the parts the caller already
 * read as single-quoted. A path keeps its / and \ to resolve by (slashes reads \ as /), so this
 * is an extra reading, not a replacement: ev\als also reads as evals, r\m as rm.
 */
const deEscape = (word) => (word.includes("\\") ? word.replace(/\\(.)/g, "$1") : word);

/** A command name from a word: path and .exe dropped for an absolute path, lower case. */
const nameOf = (word) =>
  (/^(?:[a-z]:)?[\\/]/i.test(word) ? word.replace(/^.*[\\/]/, "") : word)
    .replace(/\.exe$/i, "")
    .toLowerCase();

/** The command name a word stands for: its own, or its backslash-escaped reading (Bash). */
const commandName = (word, tool) => {
  const name = nameOf(word);
  if (tool === "PowerShell" || !word.includes("\\")) return name;
  const bare = nameOf(deEscape(word));
  return KNOWN.has(bare) || INTERPRETER.test(bare) ? bare : name;
};

/** Cuts a command line into stages; `piped` says a stage reads the one before it. */
function splitStages(code) {
  const spans = [...code.matchAll(QUOTED)].map((m) => [m.index, m.index + m[0].length]);
  let span = 0;
  const quoted = (i) => {
    while (span < spans.length && spans[span][1] <= i) span++;
    return span < spans.length && i >= spans[span][0];
  };
  const stages = [];
  let text = "";
  let piped = false;
  // `term` is the operator that ends a stage; the next command runs for sure only after `&&`.
  const cut = (next, term) => {
    stages.push({ text, piped, term });
    text = "";
    piped = next;
  };
  for (let i = 0; i < code.length; i++) {
    const [ch, next] = [code[i], code[i + 1]];
    if (!quoted(i)) {
      if ((ch === "&" && next === "&") || (ch === "|" && next === "|")) {
        cut(false, ch === "&" ? "&&" : "||");
        i++;
        continue;
      }
      if (ch === "|") {
        cut(true, "|");
        continue;
      }
      if (ch === ";" || ch === "\n" || (ch === "&" && next !== ">" && code[i - 1] !== ">")) {
        cut(false, ch);
        continue;
      }
    }
    text += ch;
  }
  cut(false, "");
  return stages;
}

/**
 * The tags of the here-documents a line opens, in order, read as Bash does: a << outside quotes,
 * before a # that starts a comment, and neither a <<< here-string nor a shift inside (( )). A $( )
 * or backticks inside double quotes is a command again. `stack` holds the quotes and groups open
 * at the start of the line, and is left with those open at its end (a quote may span lines).
 */
function heredocTags(line, stack, tags) {
  let closed = true; // whether a )) may still follow on this line
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const top = stack.at(-1);
    if (top === "'") {
      if (ch === "'") stack.pop();
      continue;
    }
    if (ch === "\\") {
      i++; // an escaped character, in $'...', "..." or a command
      continue;
    }
    if (top === "$'") {
      if (ch === "'") stack.pop();
      continue;
    }
    const arithmetic = ch === "(" ? line[i + 1] === "(" : ch === "$" && line.startsWith("((", i + 1);
    if (top === '"') {
      if (ch === '"') stack.pop();
      else if (ch === "`") stack.push("`");
      else if (ch === "$" && line[i + 1] === "(" && !arithmetic) {
        stack.push("(");
        i++;
      }
      continue;
    }
    // A command: unquoted, or inside $( ), ( ) or backticks.
    if (ch === "#" && (i === 0 || /[\s;&|()]/.test(line[i - 1]))) break;
    if (arithmetic && closed) {
      const end = line.indexOf("))", i + 2);
      if (end < 0) closed = false;
      else i = end + 1;
    } else if (ch === "$" && (line[i + 1] === "'" || line[i + 1] === "(")) {
      stack.push(line[i + 1] === "'" ? "$'" : "(");
      i++;
    } else if (ch === "(") stack.push("(");
    else if (ch === ")" && top === "(") stack.pop();
    else if (ch === "`") {
      if (top === "`") stack.pop();
      else stack.push("`");
    } else if (ch === "'" || ch === '"') stack.push(ch);
    else if (ch === "<" && line[i + 1] === "<" && line[i + 2] !== "<" && line[i - 1] !== "<") {
      HEREDOC_OPERATOR.lastIndex = i;
      const m = HEREDOC_OPERATOR.exec(line);
      if (m !== null) {
        tags.push(m[2]);
        i = HEREDOC_OPERATOR.lastIndex - 1;
      }
    }
  }
  return stack;
}

/**
 * Here-document bodies are data (a commit message, a note) unless a shell reads them: they are
 * taken out of the text and kept in `bodies` (tag to texts, in order) for the stage that reads
 * it. A body runs from the line after its command to the first line that holds only its tag; the
 * bodies of one line follow each other, and one that is never closed is left in the text, where
 * it is read as commands. The scan is linear: each tag's closing lines are listed once. A shell
 * runs its body as a child, so a cd in it does not reach the lines after the here-document.
 * PowerShell has no here-documents (a << outside a string does not parse), so its text is kept.
 */
function stripHeredocs(text, bodies, tool) {
  if (tool === "PowerShell" || !text.includes("<<")) return text;
  const lines = text.split("\n");
  const closers = new Map();
  for (const [n, line] of lines.entries()) {
    const tag = HEREDOC_CLOSER.exec(line)?.[1];
    if (tag === undefined) continue;
    if (!closers.has(tag)) closers.set(tag, { lines: [], at: 0 });
    closers.get(tag).lines.push(n);
  }
  // The first closing line of `tag` after line `n`; lines are asked for in order.
  const closerAfter = (tag, n) => {
    const list = closers.get(tag);
    if (list === undefined) return -1;
    while (list.at < list.lines.length && list.lines[list.at] <= n) list.at++;
    return list.at < list.lines.length ? list.lines[list.at] : -1;
  };
  const kept = [];
  const stack = [];
  for (let n = 0; n < lines.length; n++) {
    const tags = [];
    heredocTags(lines[n], stack, tags);
    kept.push(lines[n]);
    let end = n;
    for (const tag of tags) {
      const close = closerAfter(tag, end);
      if (close < 0) break;
      if (!bodies.has(tag)) bodies.set(tag, { texts: [], at: 0 });
      bodies.get(tag).texts.push(lines.slice(end + 1, close + 1).join("\n"));
      end = close;
    }
    n = end;
  }
  return kept.join("\n");
}

/** The here-document bodies a stage reads: those whose `<<TAG` is in its text. */
function takeBodies(stage, bodies) {
  const taken = [];
  if (bodies.size === 0) return taken;
  for (const m of stage.matchAll(/<<-?[ \t]*(['"]?)(\w+)\1/g)) {
    const queue = bodies.get(m[2]);
    if (queue !== undefined && queue.at < queue.texts.length) taken.push(queue.texts[queue.at++]);
  }
  return taken;
}

/** The bodies of $( ) and backticks outside single quotes: they run as commands. */
function substitutions(code) {
  const live = code.replace(/'[^']*'/g, (span) => " ".repeat(span.length));
  return [...live.matchAll(SUBSTITUTION)].map((m) =>
    code.slice(m.index + (m[1] === undefined ? 1 : 2), m.index + m[0].length - 1),
  );
}

/** The ( ) and $( ) groups of a stage, outside quotes, and the stage without them. */
function parenGroups(text) {
  const live = text.replace(QUOTED, (span) => " ".repeat(span.length));
  const groups = [];
  let outer = text;
  for (const m of [...live.matchAll(GROUP)].reverse()) {
    groups.unshift(text.slice(m.index + m[0].indexOf("(") + 1, m.index + m[0].length - 1));
    outer = `${outer.slice(0, m.index)} ${outer.slice(m.index + m[0].length)}`;
  }
  return { outer, groups };
}

/** How many ( are left open and how many ) close an earlier one in a stage, outside quotes. */
function parenBalance(text) {
  const live = text.replace(QUOTED, (span) => " ".repeat(span.length));
  let opens = 0;
  let closes = 0;
  for (const ch of live) {
    if (ch === "(") opens++;
    else if (ch === ")") {
      if (opens > 0) opens--;
      else closes++;
    }
  }
  return { opens, closes };
}

/**
 * Runs `read` for a child of the current shell: the folder it moves to is left behind when it
 * ends. A ( ) group and $( ) are children in Bash, but in PowerShell they share the session's
 * location; a nested shell is a process of its own in both (`own`).
 */
function inChild(ctx, own, read) {
  const saved =
    own || ctx.tool !== "PowerShell"
      ? { dir: ctx.dir, unsure: ctx.unsure, chainReliable: ctx.chainReliable }
      : null;
  const hit = read();
  if (saved !== null) Object.assign(ctx, saved);
  return hit;
}

/** A backslash joins the next line only when it is not itself escaped: an odd run of them. */
const joinBackslashLines = (text) =>
  text.replace(/(?<!\\)(\\+)\r?\n/g, (match, run) => (run.length % 2 === 1 ? run.slice(1) : match));

/**
 * A git command's subcommand (lower case), the words after it, the folders of its -C options in
 * order, and whether a --git-dir or --work-tree option points it at another tree; null when it
 * names no subcommand.
 */
function gitParts(rest) {
  const dirs = [];
  const configSets = [];
  let rerouted = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "-C") {
      if (rest[i + 1] !== undefined) dirs.push(rest[i + 1]);
      i += 1;
    } else if (/^--(?:git-dir|work-tree)$/.test(rest[i])) {
      rerouted = true;
      i += 1; // its value is the next word (the = form is split by the =)
    } else if (rest[i] === "-c" || rest[i] === "--config-env") {
      if (rest[i + 1] !== undefined) configSets.push(rest[i + 1]); // -c key=value → key is a word
      i += 2;
    } else if (GIT_VALUE_OPTIONS.has(rest[i])) i += 1;
    else if (!rest[i].startsWith("-")) {
      return { sub: rest[i].toLowerCase(), args: rest.slice(i + 1), dirs, rerouted, configSets };
    }
  }
  return null;
}

/**
 * The command names a stage runs, and its git command if it runs one. In Bash that is the command
 * position (after assignments and then/do), and every known command after a wrapper such as sudo
 * or xargs; in PowerShell any word may be the command (a pipeline, a script block).
 */
function commandNames(stage, tool) {
  const raw = words(stage.replace(ASSIGNMENT, ""));
  const lower = raw.map((word) => commandName(word, tool));
  const from = tool === "PowerShell" ? 0 : Math.max(0, lower.findIndex((w) => !LEADERS.has(w)));
  const scope = lower.slice(from);
  const anyWord = tool === "PowerShell" || WRAPPERS.has(scope[0]);
  // An English word such as copy or install names a command only where a command starts.
  const atStart = (i) => scope.slice(0, i).every((w) => WRAPPERS.has(w) || w.startsWith("-"));
  const known = (w, i) =>
    (KNOWN.has(w) || INTERPRETER.test(w)) && (!PLAIN_ENGLISH.has(w) || atStart(i));
  const names = anyWord ? scope.filter(known) : scope.slice(0, 1);
  // What eval runs: the words after it, re-parsed as a command (eval rm, eval "rm -rf evals").
  const evalAt = names.some((w) => EVAL_VERBS.has(w)) ? scope.findIndex((w) => EVAL_VERBS.has(w)) : -1;
  const evalArgs = evalAt < 0 ? null : raw.slice(from + evalAt + 1).join(" ");
  const at = names.includes("git") ? scope.indexOf("git") : -1;
  const git = at < 0 ? null : gitParts(raw.slice(from + at + 1));
  // A GIT_DIR, GIT_WORK_TREE or GIT_INDEX_FILE assignment on the line reroutes git at another tree.
  if (git !== null && /(?:^|[\s;&|(])GIT_(?:DIR|WORK_TREE|INDEX_FILE)=/.test(stage)) {
    git.rerouted = true;
  }
  return { names, git, evalArgs };
}

/**
 * A cd, pushd or Set-Location changes the folder in effect, and adds it to those paths are
 * checked from; only the last few are kept, so a line of thousands of cds stays cheap. A popd,
 * `cd -` or `cd $OLDPWD` goes back to a folder the guard does not track: it is one of the
 * remembered ones, which `unsure` says. then, do, { and the like before the command are skipped.
 */
function followCd(tokens, ctx, term) {
  const first = tokens.findIndex((word) => !LEADERS.has(word.toLowerCase()));
  const [command = "", ...args] = first < 0 ? [] : tokens.slice(first);
  if (/^(?:popd|pop-location)$/i.test(command)) ctx.unsure = true;
  if (!/^(?:cd|chdir|pushd|sl|set-location|push-location)$/i.test(command)) return;
  const target = args.find((word) => word === "-" || !word.startsWith("-"));
  if (target === undefined) return;
  if (target === "-" || /^\$\{?oldpwd/i.test(target)) {
    ctx.unsure = true;
    ctx.chainReliable = false;
    return;
  }
  const next = resolveCased(target, ctx.dir, ctx);
  if (next.length > MAX_PATH) return; // a shell's cd fails on a path this long: it stays put
  ctx.dir = next;
  const low = next.toLowerCase();
  const seen = ctx.dirs.findIndex((dir) => dir.toLowerCase() === low);
  if (seen > 0) ctx.dirs.splice(seen, 1);
  if (seen !== 0) ctx.dirs.push(next);
  if (ctx.dirs.length > MAX_CD + 1) ctx.dirs.splice(1, 1);
  // A cd joined by && must have succeeded for the next command to run, so the folder it reached is
  // known and an explicit name is judged from there alone (see classify). A cd joined by ; (or
  // whose target is a variable or glob) might fail, so the folder is no longer certain and the
  // earlier ones are kept in play.
  if (term !== "&&" || /[$*?`]/.test(slashes(target))) ctx.chainReliable = false;
}

/**
 * The scripts a shell is given: with -c, /c or -Command, its quoted texts, else the rest; and
 * what it reads from a pipe or a here-document (`readable`), which a shell started by -c may run
 * too (`bash -c bash <<EOF`).
 */
function nestedScripts(names, tokens, stage, readable, tool) {
  if (!names.some((name) => SHELLS.has(name))) return [];
  const quoted = [...stage.matchAll(QUOTED)].map((m) => m[1] ?? m[2]);
  // PowerShell runs cmd/powershell even without a separate /c flag (Start-Process cmd
  // -ArgumentList '/c del x', & cmd …): scan its quoted arguments as commands.
  if (tool === "PowerShell") return [...quoted, ...readable];
  const flag = tokens.findIndex((word) => SHELL_FLAG.test(word));
  if (flag < 0) return readable;
  return [...(quoted.length > 0 ? quoted : [tokens.slice(flag + 1).join(" ")]), ...readable];
}

// Commands that read a script from their standard input or a named producer, so the producer's
// output is run: a shell, an eval verb, or source / its `.` alias.
const SCRIPT_CONSUMERS = new Set([...SHELLS, ...EVAL_VERBS, "source", "."]);

/**
 * What a producer command prints, when the guard can know it: `echo`/`printf` of literal words
 * (no $ or backtick) print those words, which are then run as a command. Any other producer
 * (base64 -d, curl, cat of a file, a variable) is opaque: `block`, so a consumer fails closed.
 * Null when `text` names no producer.
 */
function producerOutput(text) {
  if (text === undefined || text === null || text.trim() === "") return null;
  const toks = words(text.replace(ASSIGNMENT, ""));
  const start = toks.findIndex(
    (word) => !LEADERS.has(word.toLowerCase()) && !WRAPPERS.has(nameOf(word)),
  );
  const name = start < 0 ? "" : nameOf(toks[start]);
  if (name !== "echo" && name !== "printf") return { block: true };
  let args = toks.slice(start + 1).filter((word) => !/^-[neE]+$/.test(word));
  if (name === "printf" && args[0] !== undefined && args[0].includes("%")) args = args.slice(1);
  if (args.some((word) => word.includes("$") || word.includes("`"))) return { block: true };
  return { script: args.join(" ") };
}

/**
 * The scripts a consumer runs from a producer, and whether any producer is opaque (`block`): a
 * `<<<` here-string (literal text), a `<(cmd)` process substitution, a `$(cmd)` substitution fed
 * to `-c`/eval, and the previous pipeline stage when the consumer reads a pipe.
 */
function builtScripts(stageText, piped, prevText) {
  const scripts = [];
  let block = false;
  const add = (producer) => {
    const out = producerOutput(producer);
    if (out === null) return;
    if (out.block) block = true;
    else scripts.push(out.script);
  };
  for (const m of stageText.matchAll(/<<<\s*(?:"([^"]*)"|'([^']*)'|([^\s"'|&;<>()]+))/g)) {
    const literal = m[1] ?? m[2] ?? m[3];
    if (/[$`]/.test(literal)) block = true;
    else scripts.push(literal);
  }
  for (const m of stageText.matchAll(/<\(([^()]*)\)/g)) add(m[1]);
  for (const m of stageText.matchAll(SUBSTITUTION)) add(m[1] ?? m[2]);
  if (piped) add(prevText);
  return { scripts, block };
}

/**
 * Where a copy or move lands and what it takes there: `target` is the word after -Destination or
 * -t (`flagged` for -t and --target-directory, which name a folder), else the last operand (xcopy
 * and robocopy: the second, robocopy's later words being file names), and `sources` the other
 * operands. With one operand, PowerShell copies or moves into the folder in effect: ".".
 */
function landing(names, tokens, operands) {
  const flag = tokens.findIndex((word) => DESTINATION_FLAG.test(word));
  if (flag >= 0 && tokens[flag + 1] !== undefined) {
    const at = operands.indexOf(tokens[flag + 1]);
    return {
      target: tokens[flag + 1],
      flagged: /^(?:-t|--target-directory)$/i.test(tokens[flag]),
      sources: operands.filter((_, i) => i !== at),
    };
  }
  if (names.includes("robocopy") || names.includes("xcopy")) {
    return { target: operands[1], flagged: false, sources: operands.slice(0, 1) };
  }
  if (operands.length === 1) return { target: ".", flagged: true, sources: operands };
  return { target: operands.at(-1), flagged: false, sources: operands.slice(0, -1) };
}

/** Whether `path` is a folder on disk. */
function isFolder(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * What a copy or move into `target` would change there, as a hit. The target is judged as a file,
 * and also as a folder that may hold protected paths when a whole copy (a recursive copy or a
 * move) would create it, being no folder on disk, or when a content copy fills it. When it names
 * a folder (a final / or \, . or .., -t, a folder on disk, or several sources), each source also
 * lands in it under its own last name, <target>/<name>, judged as a folder too for a whole copy;
 * a glob there may be any name, so it is judged as <target>/*. A content copy (xcopy, robocopy,
 * rsync x/, cp x/.) lands in the target itself. Replacing a build record is not deleting it, so
 * that rule is left out here.
 */
function landingHit(landed, ctx, { whole, contents, moving }) {
  const { target, flagged, sources } = landed;
  // A copy writes through a hard link; a move replaces the name and leaves the file alone.
  const judge = (raw, folder) => {
    const hit = hitOn(raw, ctx, { holders: folder });
    if (hit !== undefined && hit.rule !== "build") return hit;
    return moving ? undefined : linkHit(raw, ctx);
  };
  const onDisk = ctx.dirs.map((dir) => isFolder(resolveCased(target, dir, ctx)));
  const filled = sources.some((source) => contents(source));
  const own = judge(target, filled || (whole && onDisk.includes(false)));
  if (own !== undefined) return own;
  const folder =
    flagged || /[\\/]$|(?:^|[\\/])\.\.?$/.test(target) || onDisk.includes(true) || sources.length > 1;
  if (!folder) return undefined;
  const base = target.replace(/[\\/]+$/, "");
  return firstOf(sources, (source) => {
    if (contents(source)) return undefined;
    const name = slashes(source).replace(/\/+$/, "").split("/").at(-1);
    const glob = /[*?[]/.test(name);
    return judge(`${base}/${glob ? "*" : name}`, whole || glob);
  });
}

/**
 * Whether a command makes a link: ln, link, mklink, fsutil hardlink, cp -l or -s, and New-Item
 * with a link -ItemType.
 */
function makesLink(names, tokens) {
  if (names.some((name) => LINKS.has(name))) return true;
  const fsutil = names.includes("fsutil");
  if (fsutil && tokens.some((word) => word.toLowerCase() === "hardlink")) return true;
  if (names.includes("cp") && tokens.some((word) => CP_LINK.test(word))) return true;
  if (!names.includes("new-item") && !names.includes("ni")) return false;
  const flag = tokens.findIndex((word) => ITEM_TYPE.test(word));
  return flag >= 0 && LINK_TYPE.test(tokens[flag + 1] ?? "");
}

/** Whether the archive command extracts (so it fills a destination), by each tool's mode. */
function isExtracting(names, tokens) {
  if (names.includes("expand-archive")) return true;
  // unzip extracts unless it only lists or tests (-l, -t, -v, -z).
  if (names.includes("unzip")) return !tokens.some((word) => /^-[ltvz]/i.test(word));
  if (names.includes("7z") || names.includes("7za") || names.includes("7zr")) {
    return tokens.some((word) => /^[xe]$/i.test(word)); // 7z x / e
  }
  if (names.includes("cpio")) {
    return tokens.some((word) => /^--extract$|^-[a-z]*i/i.test(word)); // cpio -i
  }
  // tar, bsdtar, jar: an x mode (x, xf, -x, --extract).
  return tokens.some((word) => TAR_EXTRACT.test(word));
}

/**
 * The destination an extraction fills: the value of a destination flag — separate (-C evals) or
 * attached (-Cevals, -devals, -oevals, --directory=evals, -DestinationPath:evals) — else the
 * folder in effect, into which the archive unpacks.
 */
function extractDest(names, tokens, ctx) {
  const tar = names.includes("tar") || names.includes("bsdtar");
  const sevenZ = names.includes("7z") || names.includes("7za") || names.includes("7zr");
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    if (tar && (word === "-C" || /^--directory$/i.test(word))) return tokens[i + 1];
    if (names.includes("unzip") && word === "-d") return tokens[i + 1];
    if (names.includes("expand-archive") && /^-destinationpath$/i.test(word)) return tokens[i + 1];
    const attached =
      (tar && /^-C(.+)$/.exec(word)) ||
      (tar && /^--directory=(.+)$/i.exec(word)) ||
      (names.includes("unzip") && /^-d(.+)$/.exec(word)) ||
      (sevenZ && /^-o(.+)$/i.exec(word)) ||
      (names.includes("expand-archive") && /^-destinationpath[:=](.+)$/i.exec(word));
    if (attached) return attached[1];
  }
  return "."; // no flag: the folder in effect
}

/**
 * An extraction into a folder that holds protected paths, as a hit: the destination is filled, so
 * it is judged as a folder. With no destination flag the folder in effect is the destination, so
 * `cd evals && tar xf a.tar` and `tar xf a.tar` at a frozen root are caught.
 */
function extractionHit(names, tokens, ctx) {
  if (!names.some((name) => EXTRACTORS.has(name)) || !isExtracting(names, tokens)) return undefined;
  const dest = extractDest(names, tokens, ctx);
  return hitOn(dest, ctx, { holders: true }) ?? linkHit(dest, ctx);
}

/**
 * The protected path that a write command would change, as a hit. `source` is a hit on a path the
 * command works from without naming it: what an earlier stage of its pipeline listed, or a ( )
 * group read.
 */
function writtenPath(names, tokens, ctx, source) {
  const has = (set) => names.some((name) => set.has(name));
  const inPlaceFlag = tokens.some((word) => /^-[a-zA-Z]*i|^--in-place/.test(word));
  // gawk -i inplace rewrites the files it names, like sed -i; awk needs the inplace extension.
  const awkInPlace =
    (names.includes("awk") || names.includes("gawk")) &&
    tokens.some((word) => /^-i/i.test(word)) &&
    tokens.some((word) => /inplace/i.test(word));
  const inPlace = (inPlaceFlag && names.some((name) => IN_PLACE.has(name))) || awkInPlace;
  const extract = extractionHit(names, tokens, ctx);
  if (extract !== undefined) return extract;
  const linking = makesLink(names, tokens);
  const deleting = has(DELETES) || (names.includes("find") && tokens.includes("-delete"));
  const moving = has(MOVES);
  const copying = has(COPIES) && !linking;
  const writing = has(WRITES) && !linking;
  if (!(linking || deleting || moving || copying || writing || inPlace)) return undefined;
  const operands = tokens.filter(
    (word) => !word.startsWith("-") && !CMD_OPTION.test(word) && !names.includes(nameOf(word)),
  );
  if (linking) {
    // A link to or from a protected path, or a folder that holds one, gives it a second name. A
    // symbolic link reads a relative target from its own folder: each operand is also checked
    // from the folder of every other one, whichever is the link.
    const candidates = [...operands];
    for (const link of operands) {
      for (const target of operands) {
        if (target === link || /^(?:[/~$]|[a-z]:)/i.test(slashes(target))) continue;
        candidates.push(posix.join(posix.dirname(slashes(link)), slashes(target)));
      }
    }
    const hit = candidates.find((word) => classify(word, ctx, { holders: true }) !== undefined);
    return hit === undefined ? undefined : { rule: "link", raw: hit };
  }
  if (source !== undefined) {
    // A placeholder for the piped item — xargs's {} or PowerShell's $_/$PSItem — stands for what
    // the pipeline fed. For a copy only the destination placeholder is a write (cp /tmp/x {}, not
    // cp {} /tmp which reads the piped file); for any other write, a placeholder operand is it.
    if (copying) {
      const { target } = landing(names, tokens, operands);
      if (target !== undefined && PIPED_ITEM.test(target)) return source;
    } else {
      if (operands.some((word) => PIPED_ITEM.test(word))) return source;
      // No path of its own (a move needs a destination of its own): it acts on the source.
      const own = operands.filter((word) => !NO_PATH.test(word)).length;
      if (own <= (moving ? 1 : 0)) return source;
    }
  }
  if (deleting) {
    const hit = firstOf(operands, (word) => hitOn(word, ctx, { holders: true }));
    if (hit !== undefined) return hit;
  }
  if (moving || copying) {
    // What a move takes away counts as a deletion; where it or a copy lands, as written there.
    const landed = landing(names, tokens, operands);
    const taken = moving
      ? firstOf(landed.sources, (word) => hitOn(word, ctx, { holders: true }))
      : undefined;
    if (taken !== undefined) return taken;
    const flags = ctx.tool === "PowerShell" ? PS_RECURSE : CP_RECURSIVE;
    const byContent = names.some((name) => CONTENT_COPIES.has(name));
    const rsync = names.includes("rsync");
    const hit =
      landed.target === undefined
        ? undefined
        : landingHit(landed, ctx, {
            moving,
            whole: moving || byContent || tokens.some((word) => flags.test(word)),
            // A folder's content, not the folder: xcopy, robocopy, rsync x/, cp x/. or x/..
            contents: (word) =>
              byContent || (rsync && /[\\/]$/.test(word)) || /(?:^|[\\/])\.\.?[\\/]*$/.test(word),
          });
    if (hit !== undefined) return hit;
  }
  if (!writing && !inPlace) return undefined;
  return firstOf(operands, (word) => writeHit(word, ctx));
}

/**
 * How a checkout or restore reads: `source` the revision it reads from (null for the index),
 * `paths` its pathspecs, `tree` whether the pathspecs come from a revision, and `full` whether it
 * is a whole-tree move to `source` with no pathspec (so the whole revision is compared). The
 * one-word checkout form is a branch or commit when `resolve(word)` says so, else a pathspec, as
 * git itself decides. Branch-creating flags are handled by the caller.
 */
function gitCheckoutParts(sub, args, resolve) {
  const dash = args.indexOf("--");
  const before = dash < 0 ? args : args.slice(0, dash);
  const after = dash < 0 ? [] : args.slice(dash + 1);
  let source = null;
  const positional = [];
  for (let i = 0; i < before.length; i++) {
    const word = before[i];
    if (sub === "restore" && /^(?:--source|-s)$/.test(word)) {
      source = before[i + 1] ?? null;
      i++; // --source=x is split by the = into two words
    } else if (sub === "restore" && /^-s.+/.test(word)) source = word.slice(2);
    else if (word === "-" || !word.startsWith("-")) positional.push(word);
  }
  if (sub === "restore") {
    return { source, tree: source !== null, full: false, paths: [...positional, ...after] };
  }
  if (dash >= 0) {
    const src = positional[0] ?? null;
    const paths = [...positional.slice(1), ...after];
    return { source: src, tree: src !== null, full: src !== null && paths.length === 0, paths };
  }
  if (positional.length >= 2) {
    return { source: positional[0], tree: true, full: false, paths: positional.slice(1) };
  }
  // One word: a branch or commit when it resolves, else a pathspec read from the index.
  if (positional.length === 1 && resolve(positional[0]) !== null) {
    return { source: positional[0], tree: true, full: true, paths: [] };
  }
  return { source: null, tree: false, full: false, paths: positional };
}

/** Whether the word at `i` is the value of an option that `valued` matches (-m msg, -e x). */
const optionValue = (args, i, valued) => valued !== null && valued.test(args[i - 1] ?? "");

/** The words of git command arguments that are neither options nor option values: paths. */
const gitOperands = (args, valued = null) =>
  args.filter((word, i) => word !== "--" && !word.startsWith("-") && !optionValue(args, i, valued));

/** `ctx` moved to git's -C folders, in order, from each folder a path is checked from. */
function movedTo(ctx, targets) {
  const move = (dir) => targets.reduce((at, target) => resolveCased(target, at, ctx), dir);
  return { ...ctx, dir: move(ctx.dir), dirs: ctx.dirs.map(move) };
}

/**
 * The protected paths of the build root, as it spells them, relative to the repository root: the
 * guard's folder, the three settings files and, for every frozen agent, its evals folder and its
 * design, spec and build records. A revision that leaves all of these unchanged cannot rewrite a
 * frozen file by being checked out. Cached on the context.
 */
function protectedPaths(ctx) {
  if (ctx.protectedPaths !== undefined) return ctx.protectedPaths;
  const list = [HOOKS_DIR, ...SETTINGS_FILES];
  for (const agent of ctx.roots[0].agents) {
    if (!agent.frozen) continue;
    list.push(
      joined(agent.cased, "evals"),
      joined(agent.cased, "docs/agent/design.md"),
      joined(agent.cased, SPEC_FILE),
      joined(agent.cased, BUILD_FILE),
    );
  }
  ctx.protectedPaths = list;
  return list;
}

/** Runs git in the build root with a short timeout; "same"/"differ" from an exit of 0/1, else "error". */
function gitCompare(ctx, args) {
  try {
    const result = spawnSync("git", ["-C", ctx.roots[0].cased, ...args], {
      timeout: 3000,
      stdio: "ignore",
      windowsHide: true,
    });
    if (result.error !== undefined || result.signal !== null) return "error";
    if (result.status === 0) return "same";
    return result.status === 1 ? "differ" : "error";
  } catch {
    return "error";
  }
}

/**
 * How revision `rev`'s protected paths compare with HEAD's: "same", "differ", or "error" when the
 * comparison cannot be run (git missing, a bad revision, not a repository). The caller fails closed
 * on anything but "same", since an unverifiable revision could rewrite a frozen file.
 */
const revMovesProtected = (ctx, rev) =>
  gitCompare(ctx, ["diff", "--quiet", "HEAD", rev, "--", ...protectedPaths(ctx)]);

/** Whether the index differs from HEAD at a protected path (so a worktree restore from it writes one). */
const indexMovesProtected = (ctx) =>
  gitCompare(ctx, ["diff", "--cached", "--quiet", "HEAD", "--", ...protectedPaths(ctx)]) !== "same";

/**
 * Whether `word` resolves to a commit, read as git does (itself, then the DWIM `origin/<word>`, and
 * `-` as `@{-1}`); used to tell a one-word checkout or a reset's commit from a pathspec. Null when
 * none resolves.
 */
function resolveCommit(ctx, word) {
  const candidates = word === "-" || word === "@{-1}" ? ["@{-1}"] : [word, `origin/${word}`];
  for (const candidate of candidates) {
    try {
      const result = spawnSync(
        "git",
        ["-C", ctx.roots[0].cased, "rev-parse", "--verify", "-q", `${candidate}^{commit}`],
        { timeout: 3000, stdio: ["ignore", "ignore", "ignore"], windowsHide: true },
      );
      if (result.status === 0 && result.error === undefined) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** The current branch's short name, or null (a detached HEAD, no repository, or git missing). */
function currentBranch(ctx) {
  try {
    const result = spawnSync(
      "git",
      ["-C", ctx.roots[0].cased, "symbolic-ref", "--short", "-q", "HEAD"],
      { timeout: 3000, encoding: "utf8", windowsHide: true },
    );
    return result.status === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

/**
 * What a git command would change: a protected path it removes, moves or writes (rm, mv, clean,
 * checkout and restore of paths, stash of paths), or, while any agent is frozen, a verb that is
 * the owner's: one that rewrites the working tree from another commit, a checkout or restore
 * from another commit that reaches a protected path, and clean or stash -u with no path in a
 * folder that holds protected paths.
 */
function gitHit(git, ctx) {
  const gctx = git.dirs.length === 0 ? ctx : movedTo(ctx, git.dirs);
  const { sub, args, rerouted } = git;
  const owner = (text) => (ctx.anyFrozen ? { rule: "git", text } : undefined);
  // With no path, clean works on the whole folder it runs in; stash -u is repo-wide.
  const pathless = () =>
    classify(".", gctx, { holders: true }) === undefined
      ? undefined
      : owner(
          `git ${sub} with no path works on the whole folder it runs in, which holds frozen ` +
            "paths or the guard",
        );
  const first = (list, options) => firstOf(list, (word) => hitOn(word, gctx, options));
  // A move of HEAD, the branch or the working tree to `target`: compare its protected paths with
  // HEAD's in one diff (- is @{-1}; a bare name that will not resolve is tried as origin/<name>,
  // git's DWIM). Unchanged is open; a difference, or a target whose tree cannot be read, is the
  // owner's.
  const revTargetHit = (target) => {
    const mapped = target === "-" ? "@{-1}" : target;
    let cmp = revMovesProtected(ctx, mapped);
    if (cmp === "error" && !mapped.includes("/")) cmp = revMovesProtected(ctx, `origin/${mapped}`);
    if (cmp === "same") return undefined;
    return owner(
      cmp === "differ"
        ? `git ${sub} ${target} moves to a revision whose protected files differ from HEAD`
        : `git ${sub} ${target}: the guard cannot read that revision's tree to compare it with HEAD`,
    );
  };
  // A --git-dir, --work-tree or GIT_* env points git at another tree: the owner's while frozen.
  if (rerouted) {
    return owner(`git ${sub} with a --git-dir, --work-tree or GIT_* option points at another tree`);
  }
  // A -c key=value (any subcommand) that sets an owner-only config entry.
  const inlineConfig = git.configSets.find((key) => GIT_CONFIG_OWNED.test(key));
  if (inlineConfig !== undefined) {
    return owner(`git -c ${inlineConfig} sets a config entry that can run a command or redirect git`);
  }
  if (sub === "config") {
    // The first operand is the key; a dangerous one set from any scope is the owner's.
    const key = args.find((word) => !word.startsWith("-"));
    return key !== undefined && GIT_CONFIG_OWNED.test(key)
      ? owner(`git config ${key} sets a config entry that can run a command or redirect git`)
      : undefined;
  }
  if (GIT_OWNER_VERBS.has(sub)) {
    return owner(`git ${sub} writes the working tree from the index or another commit`);
  }
  if (sub === "update-index") {
    const flag = args.find((word) => /^--(?:cacheinfo|index-info|add)$/.test(word));
    if (flag === undefined) return undefined;
    // --index-info reads the paths from stdin, which the guard cannot see: fail closed.
    if (flag === "--index-info") return owner("git update-index --index-info stages paths from stdin");
    // --cacheinfo and --add stage a frozen path only when they name one.
    return first(gitOperands(args), { holders: true });
  }
  if (sub === "rm") return first(gitOperands(args), { holders: true });
  if (sub === "mv") {
    const operands = gitOperands(args);
    return first(operands.slice(0, -1), { holders: true }) ?? first(operands.slice(-1));
  }
  // git commands that create files in a destination folder: that folder is judged as a write.
  const intoFolder = (dest) => (dest === undefined ? undefined : first([dest], { holders: true }));
  if (sub === "worktree") {
    const operands = gitOperands(args, /^(?:-b|-B)$/);
    return operands[0]?.toLowerCase() === "add" ? intoFolder(operands[1]) : undefined;
  }
  if (sub === "submodule") {
    const operands = gitOperands(args, /^(?:-b|--branch|--reference|--name|--depth)$/);
    return operands[0]?.toLowerCase() === "add" ? intoFolder(operands[2]) : undefined;
  }
  if (sub === "clone") return intoFolder(gitOperands(args)[1]); // <repo> <dir>
  if (sub === "init") return intoFolder(gitOperands(args)[0]);
  if (sub === "clean") {
    if (args.some((word) => /^-[a-zA-Z]*n|^--dry-run$/.test(word))) return undefined; // shows only
    const paths = gitOperands(args, /^(?:-e|--exclude)$/);
    // A : magic pathspec (:/, :(top), :!src, :(exclude)src) matches across the repository, not a
    // plain folder the guard can judge: the owner's.
    if (paths.some((path) => path.startsWith(":"))) {
      return owner("git clean with a : magic pathspec can reach across the whole repository");
    }
    return paths.length === 0 ? pathless() : first(paths, { holders: true });
  }
  if (sub === "switch") {
    if (!ctx.anyFrozen) return undefined;
    const positional = args.filter((word) => word === "-" || !word.startsWith("-"));
    const create = args.some((word) => /^(?:-c|-C|--create)$/.test(word));
    // switch -c/-C <name> [<start>]: the start-point is the tree moved to; none means HEAD (open).
    // Plain switch <branch|commit|->: that is the target.
    const target = create ? positional[1] : positional[0];
    if (target === undefined) return undefined;
    return revTargetHit(target);
  }
  if (sub === "checkout" || sub === "restore") {
    // --staged with no --worktree touches the index only: open. -p/--patch and
    // --pathspec-from-file rewrite files without a pathspec the guard can read: the owner's.
    const staged = args.some((word) => /^(?:--staged|-S)$/.test(word));
    const worktree = args.some((word) => /^(?:--worktree|-W)$/.test(word));
    if (sub === "restore" && staged && !worktree) return undefined;
    if (args.some((word) => GIT_BLIND_FLAG.test(word))) {
      return owner(`git ${sub} -p/--patch or --pathspec-from-file can rewrite frozen files`);
    }
    // checkout -b/-B/--orphan <name> [<start>]: a branch created at <start> moves the tree there.
    if (sub === "checkout") {
      const at = args.findIndex((word) => /^(?:-b|-B|--orphan)$/.test(word));
      if (at >= 0) {
        if (!ctx.anyFrozen) return undefined;
        const rest = args.slice(at + 1).filter((word) => word !== "--" && !word.startsWith("-"));
        return rest[1] === undefined ? undefined : revTargetHit(rest[1]);
      }
    }
    const resolve = ctx.anyFrozen ? (word) => resolveCommit(ctx, word) : () => null;
    const { tree, source, paths, full } = gitCheckoutParts(sub, args, resolve);
    // A full checkout/restore of a revision (no pathspec): compare that revision's protected paths.
    if (full) return ctx.anyFrozen ? revTargetHit(source) : undefined;
    // With pathspecs: a protected path is written from wherever the source is; a : magic pathspec,
    // a glob or a folder that holds protected paths is reached from another commit.
    const written = firstOf(paths, (path) => writeHit(path, gctx));
    if (written !== undefined) return written;
    if (tree) {
      const reached = paths.find(
        (path) => PATHSPEC_MAGIC.test(path) || classify(path, gctx, { holders: true }) !== undefined,
      );
      if (reached !== undefined) {
        return owner(`git ${sub} from another commit over ${reached} can rewrite frozen files`);
      }
      return undefined;
    }
    // From the index into the working tree (checkout -- ., restore .): a protected path is written
    // only when the index differs from HEAD there.
    const fromIndex = paths.some(
      (path) => PATHSPEC_MAGIC.test(path) || classify(path, gctx, { holders: true }) !== undefined,
    );
    if (fromIndex && ctx.anyFrozen && indexMovesProtected(ctx)) {
      return owner(`git ${sub} writes the working tree from an index that differs from HEAD at a protected path`);
    }
    return undefined;
  }
  if (sub === "stash") {
    const valued = /^(?:-m|--message)$/;
    const operands = gitOperands(args, valued);
    const action = operands[0]?.toLowerCase();
    if (STASH_RESTORES.has(action)) {
      return owner(`git stash ${action} writes a stash back over the working tree`);
    }
    if (STASH_ACTIONS.has(action) && action !== "push" && action !== "save") return undefined;
    // The paths: after --, else the words after push or save (a bare `git stash` has none).
    const dash = args.indexOf("--");
    const named = STASH_ACTIONS.has(action) ? operands.slice(1) : [];
    const paths = dash >= 0 ? args.slice(dash + 1) : named;
    const untracked = args.some(
      (word, i) => STASH_UNTRACKED.test(word) && !optionValue(args, i, valued),
    );
    // stash -u/-a saves and removes untracked files across the whole repository, wherever it runs.
    if (paths.length === 0) {
      return untracked
        ? owner("git stash -u/-a saves and removes untracked files across the repository")
        : undefined;
    }
    if (paths.some((path) => path.startsWith(":"))) {
      return owner("git stash with a : magic pathspec can reach across the whole repository");
    }
    return first(paths, { holders: untracked });
  }
  if (sub === "reset") {
    // --hard, --keep and --merge discard working-tree changes whatever the revision: the owner's.
    const hard = args.find((word) => GIT_HARD_RESET.test(word));
    if (hard !== undefined) return owner(`git reset ${hard} rewrites the working tree from another commit`);
    if (!ctx.anyFrozen) return undefined;
    // git reset [--soft|--mixed] [<commit>] [--] [<pathspec>...]: the index (and branch) move to
    // <commit>; the working tree is left. Compare <commit> (the first arg when it resolves to a
    // commit, as git decides, else HEAD) with HEAD over the protected paths.
    const dash = args.indexOf("--");
    const before = (dash < 0 ? args : args.slice(0, dash)).filter((word) => !word.startsWith("-"));
    const commit = before[0] !== undefined && resolveCommit(ctx, before[0]) !== null ? before[0] : "HEAD";
    return revTargetHit(commit);
  }
  if (sub === "read-tree") {
    // read-tree <tree> reads a tree into the index (and the working tree with -u/-m): compare it.
    if (!ctx.anyFrozen) return undefined;
    const tree = gitOperands(args)[0];
    return tree === undefined ? undefined : revTargetHit(tree);
  }
  if (sub === "update-ref") {
    // update-ref <ref> <newvalue>: moves a ref (HEAD's branch, say) to another commit.
    if (!ctx.anyFrozen) return undefined;
    const value = gitOperands(args)[1];
    return value === undefined ? undefined : revTargetHit(value);
  }
  if (sub === "symbolic-ref") {
    // symbolic-ref HEAD <ref>: points HEAD at another branch, whose tree a later command uses.
    if (!ctx.anyFrozen) return undefined;
    const [name, ref] = gitOperands(args);
    return name === "HEAD" && ref !== undefined ? revTargetHit(ref) : undefined;
  }
  if (sub === "branch") {
    // branch -f/-M/-C <name> [<start>] onto the current branch moves it, like a reset.
    if (!ctx.anyFrozen) return undefined;
    if (!args.some((word) => /^(?:-f|--force|-M|-C)$/.test(word))) return undefined;
    const operands = gitOperands(args);
    const start = operands[1];
    return start !== undefined && operands[0] === currentBranch(ctx) ? revTargetHit(start) : undefined;
  }
  if (!GIT_TREE_VERBS.has(sub)) return undefined;
  return owner(`git ${sub} can rewrite frozen files from another commit`);
}

/** A small text file's contents (utf-8), or null when it is missing, too big, or unreadable. */
function readSmall(path) {
  try {
    const info = statSync(path);
    if (!info.isFile() || info.size > 262_144) return null;
    return new TextDecoder("utf-8", { fatal: false }).decode(readFileSync(path));
  } catch {
    return null;
  }
}

/** The target paths a unified diff names (its +++ and --- headers), with a leading a/ or b/ or n
 * components stripped, and the raw forms too; a /dev/null side is dropped. */
function diffTargets(text, strip) {
  const targets = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^(?:\+\+\+|---)\s+(?:"([^"]*)"|(\S+))/.exec(line);
    if (m === null) continue;
    const raw = slashes((m[1] ?? m[2]).replace(/\t.*$/, ""));
    if (raw === "/dev/null") continue;
    targets.push(raw);
    const parts = raw.split("/");
    if (strip > 0 && parts.length > strip) targets.push(parts.slice(strip).join("/"));
    if (/^[ab]\//.test(raw)) targets.push(raw.slice(2));
    targets.push(parts.at(-1)); // the basename, patch's fallback
  }
  return targets;
}

/**
 * A `patch` command's hit. patch rewrites files in place from a diff whose target files the guard
 * must know: an explicit file operand is the one target; otherwise the diff's +++/--- headers are
 * read from a here-document, a pipe, or a `-i <file>`/`< <file>` the guard can read. A target that
 * reaches a protected path is blocked; while an agent is frozen a patch whose targets cannot be
 * read is blocked too. `--dry-run` only tests, and is open.
 */
function patchHit(names, tokens, text, readable, ctx) {
  if (!names.includes("patch")) return undefined;
  if (tokens.some((word) => /^(?:--dry-run|--check)$/i.test(word))) return undefined;
  const strip = Number(/^-p(\d+)$/.exec(tokens.find((word) => /^-p\d+$/.test(word)) ?? "")?.[1] ?? 1);
  // The diff's source: a -i/--input file, or a `< file` stdin redirect (these are not operands).
  const inputs = [];
  const iAt = tokens.findIndex((word) => /^(?:-i|--input)$/.test(word));
  if (iAt >= 0 && tokens[iAt + 1] !== undefined) inputs.push(tokens[iAt + 1]);
  const live = text.replace(QUOTED, (span) => " ".repeat(span.length));
  for (const m of live.matchAll(/(?<![0-9&>])<(?!<)\s*([^\s"'|&;<>()]+)/g)) inputs.push(m[1]);
  // A here-document tag (<<EOF) is not an operand: the body is read through `readable`.
  const tags = [...text.matchAll(/<<-?\s*(['"]?)(\w+)\1/g)].map((m) => m[2]);
  // An explicit file operand (a non-flag that is neither an option value, a redirect source nor a
  // here-doc tag): patch applies the diff to it alone, so only it is the target.
  const valued = /^(?:-[iodrBVzFg]|--input|--output|--directory|--reject-file)$/;
  const operand = tokens.find(
    (word, i) =>
      !word.startsWith("-") &&
      !valued.test(tokens[i - 1] ?? "") &&
      !inputs.includes(word) &&
      !tags.includes(word) &&
      !names.includes(nameOf(word)),
  );
  if (operand !== undefined) return writeHit(operand, ctx);
  // No operand: read the diff's +++/--- target headers from the here-document, pipe or input file.
  const texts = [...readable];
  let unreadable = false;
  for (const input of inputs) {
    const content = readSmall(resolveCased(input, ctx.dir, ctx));
    if (content === null) unreadable = true;
    else texts.push(content);
  }
  for (const target of texts.flatMap((body) => diffTargets(body, strip))) {
    const hit = writeHit(target, ctx);
    if (hit !== undefined) return hit;
  }
  // Nothing readable told the guard the targets: fail closed while an agent is frozen.
  if (ctx.anyFrozen && (texts.length === 0 || unreadable)) return { rule: "patch", raw: "a diff" };
  return undefined;
}

/** An inline script (node -e, python -c, a heredoc, [IO.File]::WriteAllText) that names a path. */
function scriptWrite(names, stage, bodies, ctx) {
  const script = [stage, ...bodies].join("\n");
  const writes =
    (names.some((name) => INTERPRETER.test(name)) && SCRIPT_WRITE.test(script)) ||
    (ctx.tool === "PowerShell" && DOTNET_WRITE.test(script));
  if (!writes) return undefined;
  // A script that removes or moves is judged like a destructive shell command: a folder that holds
  // protected paths and a frozen agent's build.md count, not only the frozen files themselves. A
  // script that only creates or overwrites judges the frozen files alone, so build.md's content
  // stays editable from a script too.
  const holders = SCRIPT_DESTRUCTIVE.test(script);
  return firstOf(script.split(LOOSE), (word) => (word ? hitOn(word, ctx, { holders }) : undefined));
}

/** The hit, a protected path as the command wrote it and its rule, that a command line makes. */
function shellWrite(command, ctx, depth = 0) {
  if (depth > MAX_DEPTH) return undefined;
  const bodies = new Map();
  const stripped = stripHeredocs(command.replaceAll(">|", ">"), bodies, ctx.tool);
  // A line continues after a backslash (Bash) or a backtick (PowerShell) at the end of a line.
  const code =
    ctx.tool === "PowerShell" ? stripped.replace(/`\r?\n/g, " ") : joinBackslashLines(stripped);
  for (const inner of substitutions(code)) {
    const hit = inChild(ctx, false, () => shellWrite(inner, ctx, depth + 1));
    if (hit !== undefined) return hit;
  }
  let fed; // a hit on a path an earlier stage of this pipeline named
  let piping = []; // the here-documents the pipeline so far was given
  // The folders in effect where a ( ) group that spans stages was opened (Bash): the group's cds
  // end at its closing ), as a subshell's do.
  const opened = [];
  const stages = splitStages(code);
  for (const [at, stage] of stages.entries()) {
    if (!stage.piped) {
      fed = undefined;
      piping = [];
    }
    const readable = [...piping, ...takeBodies(stage.text, bodies)];
    piping = readable;
    const parens = ctx.tool === "PowerShell" ? { opens: 0, closes: 0 } : parenBalance(stage.text);
    for (let n = 0; n < parens.opens; n++) opened.push({ dir: ctx.dir, unsure: ctx.unsure });
    // Bash runs each side of a pipe in a subshell: a cd there ends with the stage.
    const inPipe = ctx.tool !== "PowerShell" && (stage.piped || stages[at + 1]?.piped === true);
    const kept = inPipe ? { dir: ctx.dir, unsure: ctx.unsure } : null;
    // A ( ) or $( ) group runs on its own; what it names is what this stage works from.
    const { outer: text, groups } = parenGroups(stage.text);
    let source = fed;
    for (const group of groups) {
      const hit = inChild(ctx, false, () => shellWrite(group, ctx, depth + 1));
      if (hit !== undefined) return hit;
      source ??= firstOf(words(group), (word) => hitOn(word, ctx, { holders: true }));
    }
    const tokens = words(text);
    followCd(tokens, ctx, stage.term);
    const redirects = [...text.matchAll(REDIRECT)].filter((m) => m[0].startsWith(">"));
    for (const m of redirects) {
      const hit = writeHit(m[1] ?? m[2] ?? m[3], ctx);
      if (hit !== undefined) return hit;
    }
    const { names, git, evalArgs } = commandNames(text, ctx.tool);
    // xargs -I{} / -i feeds each piped item as the replace-string; when the pipeline named a
    // protected path, substitute it so a write to {} in the nested command is seen.
    const replace = /^-I(.*)$/.exec(tokens.find((word) => /^-I/.test(word)) ?? "")?.[1];
    const placeholder = replace || (tokens.some((word) => /^-i$/.test(word)) ? "{}" : "");
    for (let script of nestedScripts(names, tokens, text, readable, ctx.tool)) {
      if (placeholder !== "" && source !== undefined) script = script.split(placeholder).join(source.raw);
      const hit = inChild(ctx, true, () => shellWrite(script, ctx, depth + 1));
      if (hit !== undefined) return hit;
    }
    // A shell, eval or source that reads its script from a producer (a pipe, <<<, <(...), $(...))
    // runs the producer's output: rescan an echo/printf literal as a command, and fail closed on
    // an opaque producer (base64 -d, curl, cat of a file, a variable) while an agent is frozen.
    if (ctx.tool !== "PowerShell" && names.some((name) => SCRIPT_CONSUMERS.has(name))) {
      const built = builtScripts(stage.text, stage.piped, stages[at - 1]?.text);
      for (const script of built.scripts) {
        const hit = inChild(ctx, true, () => shellWrite(script, ctx, depth + 1));
        if (hit !== undefined) return hit;
      }
      if (built.block && ctx.anyFrozen) {
        return { rule: "built", raw: names.find((name) => SCRIPT_CONSUMERS.has(name)) };
      }
    }
    // eval and Invoke-Expression run their arguments (and their piped input) as a command here,
    // in this shell, so a cd in them stays.
    if (evalArgs !== null || names.some((name) => EVAL_VERBS.has(name))) {
      for (const script of [evalArgs ?? "", ...readable]) {
        const hit = script === "" ? undefined : shellWrite(script, ctx, depth + 1);
        if (hit !== undefined) return hit;
      }
    }
    const hit =
      (git === null ? undefined : gitHit(git, ctx)) ??
      writtenPath(names, tokens, ctx, source) ??
      patchHit(names, tokens, stage.text, readable, ctx) ??
      scriptWrite(names, stage.text, readable, ctx);
    if (hit !== undefined) return hit;
    // What this stage names is carried to the next: a folder that holds protected paths too, since
    // the next stage may delete it (ls docs/agent/build.md | xargs rm, Get-Item ... | Remove-Item).
    // A hit is only used when that next stage is a write, so merely listing a holder is harmless.
    fed = firstOf(tokens, (word) => hitOn(word, ctx, { holders: true })) ?? source;
    if (kept !== null) Object.assign(ctx, kept);
    for (let n = 0; n < parens.closes && opened.length > 0; n++) Object.assign(ctx, opened.pop());
  }
  return undefined;
}

/** The message that blocks a shell command, from its hit. */
function shellMessage(hit) {
  switch (hit.rule) {
    case "hooks":
      return (
        `${PREFIX}this command writes ${hit.raw}, which is or holds part of .claude/hooks/. ` +
        HOOKS_RULE
      );
    case "gitdir":
      return `${PREFIX}this command writes ${hit.raw}, part of the repository's .git. ${GITDIR_RULE}`;
    case "settings":
      return (
        `${PREFIX}this command writes ${hit.raw}, a settings file that registers the guard or ` +
        `can switch it off, and no shell write may change one. ${SETTINGS_RULE}`
      );
    case "build":
      return (
        `${PREFIX}this command deletes or moves ${hit.raw}, the build record of a frozen agent: ` +
        `its content stays editable, but the file stays. ${OWNER_STEPS} ${LADDER}`
      );
    case "hardlink":
      return (
        `${PREFIX}this command writes ${hit.raw}, a hard link to ${hit.target}, which the guard ` +
        `protects: writing one name writes the other. ${LADDER}`
      );
    case "link":
      return (
        `${PREFIX}this command links ${hit.raw}, which the guard protects: a hard or symbolic ` +
        `link or a junction would give it a second name the guard does not follow. ${LADDER}`
      );
    case "git":
      return `${PREFIX}${hit.text}. ${GIT_RULE}`;
    case "built":
      return (
        `${PREFIX}this ${hit.raw} runs a script built from an opaque producer (base64 -d, curl, ` +
        "cat of a file, a variable), so the guard cannot read the command it would run and fails " +
        `closed while an agent is frozen. Run the command directly, or let the owner run it. ${LADDER}`
      );
    case "patch":
      return (
        `${PREFIX}this patch applies ${hit.raw} while an agent is frozen, and the guard cannot ` +
        "read which files it changes (the diff is not a here-document, a pipe or a readable " +
        `-i/< file), so it fails closed. Run it with --dry-run, or let the owner apply it. ${LADDER}`
      );
    default:
      return `${PREFIX}this command writes ${hit.raw}, a frozen pipeline artifact. ${LADDER}`;
  }
}

// --- The spec's Test column -----------------------------------------------------------------
// The build fills the Test column of the spec's Traceability table with the guard on: a file
// tool's call on the spec passes when, applied to the spec on disk, it changes only Test cells of
// BHV-NNN rows in the Traceability section, outside code fences.

/** Line endings as LF and no byte-order mark, so that a CRLF file and an LF edit compare. */
const asLf = (text) => text.replace(/^\u{FEFF}/u, "").replaceAll("\r\n", "\n");

/** A table row's trimmed cells, as chain reads them (an escaped pipe stays inside its cell). */
function cells(line) {
  let inner = line.trim();
  if (!inner.startsWith("|")) return null;
  inner = inner.slice(1);
  if (inner.endsWith("|") && !inner.endsWith("\\|")) inner = inner.slice(0, -1);
  return inner.split(UNESCAPED_PIPE).map((cell) => cell.trim());
}

/**
 * Whether two lines are one BHV-NNN row of the table that differs in its Test cell only, a cell
 * that holds no comment marker before or after.
 */
function testCellChange(before, after) {
  const [old, next] = [cells(before), cells(after)];
  if (old === null || next === null || old.length !== next.length) return false;
  if (old.length <= TEST_CELL || !BHV_ID.test(old[0])) return false;
  if (COMMENT_MARKER.test(old[TEST_CELL]) || COMMENT_MARKER.test(next[TEST_CELL])) return false;
  return old.every((cell, i) => i === TEST_CELL || cell === next[i]);
}

/**
 * Whether the lines `next` differ from `old` only in Test cells of rows in the Traceability
 * section, outside code fences. Both have the same lines elsewhere, and a changed line is a row,
 * never a fence or a heading, so the section and the fences are followed on `old`.
 */
function testCellsChanged(old, next) {
  let fenced = false;
  let traceability = false;
  return old.every((line, i) => {
    if (FENCE.test(line)) fenced = !fenced;
    const heading = fenced ? null : SECTION_HEADING.exec(line);
    if (heading !== null) traceability = heading[1].replace(SECTION_NUMBER, "") === TRACEABILITY;
    if (line === next[i]) return true;
    return traceability && !fenced && testCellChange(line, next[i]);
  });
}

/** How many times `old` occurs in `text`, without overlaps, from its first occurrence at `at`. */
function occurrences(text, old, at) {
  let count = 0;
  for (let i = at; i >= 0; i = text.indexOf(old, i + old.length)) count++;
  return count;
}

/**
 * A file's text once a file tool's call is applied to it, or null when the call cannot be applied
 * or is not judged: more than MAX_EDITS edits, a new_string that holds a replacement pattern, or a
 * text that would grow more than MAX_GROWTH past the file's length.
 */
function textAfter(tool, input, text) {
  if (tool === "Write") return typeof input.content === "string" ? asLf(input.content) : null;
  const edits = tool === "MultiEdit" ? input.edits : [input];
  if (!Array.isArray(edits) || edits.length > MAX_EDITS) return null;
  const limit = text.length + MAX_GROWTH;
  let result = text;
  for (const edit of edits) {
    if (!isObject(edit)) return null;
    const { old_string: from, new_string: to, replace_all: all } = edit;
    if (typeof from !== "string" || typeof to !== "string" || from === "") return null;
    if (REPLACEMENT_PATTERN.test(to)) return null;
    const [old, next] = [asLf(from), asLf(to)];
    const at = result.indexOf(old);
    if (at < 0) return null; // not found: the tool would fail, and nothing is judged
    // The length the edit leaves, counted before the text is built.
    const count = all === true ? occurrences(result, old, at) : 1;
    if (result.length + count * (next.length - old.length) > limit) return null;
    result =
      all === true
        ? result.replaceAll(old, () => next)
        : result.slice(0, at) + next + result.slice(at + old.length);
  }
  return result;
}

/**
 * Whether a file tool's call on the spec (its file_path) changes nothing but Test cells. The spec
 * is read from disk, as the agent root spells it; a spec that cannot be read fails closed.
 */
function testCellsOnly(tool, input, specFile) {
  if (!TEST_COLUMN_TOOLS.has(tool)) return false;
  let before;
  try {
    before = asLf(readFileSync(specFile, "utf8"));
  } catch {
    return false;
  }
  const after = textAfter(tool, input, before);
  if (after === null) return false;
  const [old, next] = [before.split("\n"), after.split("\n")];
  // A Write may leave out the spec's final newline, or add one: that changes no line.
  if (tool === "Write" && Math.abs(old.length - next.length) === 1) {
    const longer = old.length > next.length ? old : next;
    if (longer.at(-1) === "") longer.pop();
  }
  if (old.length !== next.length) return false;
  return testCellsChanged(old, next);
}

// --- The settings ------------------------------------------------------------------------------
// A file tool may change a settings file, except what keeps the guard running: its PreToolUse
// entry, disableAllHooks and the env key.

/** The JSON value of a text, or undefined when it does not parse. */
function parseJson(text) {
  try {
    return JSON.parse(text.replace(/^\u{FEFF}/u, ""));
  } catch {
    return undefined;
  }
}

/** A JSON value as text with every object's keys sorted, so that two values compare by content. */
const canonicalJson = (value) =>
  JSON.stringify(value ?? null, (_, inner) =>
    isObject(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  );

/** Each hook that runs the guard, with its entry's matcher, as text; sorted. */
function guardEntries(settings) {
  const found = [];
  const entries = isObject(settings.hooks) ? settings.hooks.PreToolUse : undefined;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const hooks = isObject(entry) && Array.isArray(entry.hooks) ? entry.hooks : [];
    for (const hook of hooks) {
      const command = isObject(hook) && typeof hook.command === "string" ? hook.command : "";
      if (slashes(command).includes(GUARD_SCRIPT)) {
        found.push(canonicalJson({ matcher: entry.matcher ?? null, hook }));
      }
    }
  }
  return found.sort();
}

/** The guard's entry as templates/build/settings.json registers it. */
const INSTALLED = canonicalJson({
  matcher: GUARD_MATCHER,
  hook: { type: "command", command: GUARD_COMMAND },
});

/**
 * The env entries the rule compares: all of them in a repository's settings; in the user's only
 * PATH and NODE_*, which steer the guard's interpreter.
 */
function guardedEnv(settings, user) {
  const env = settings.env;
  if (!user || !isObject(env)) return env;
  return Object.fromEntries(Object.entries(env).filter(([name]) => USER_ENV.test(name)));
}

/**
 * Why a file tool's call on a settings file is blocked, or undefined when it may run: the file
 * as the call leaves it, against the file on disk (missing, it registers nothing).
 */
function settingsVerdict(tool, input, isFilePath, found) {
  const invalid =
    "would not hold a valid JSON object after this call (or the call cannot be applied to it " +
    "as it is)";
  if (!isFilePath || !TEST_COLUMN_TOOLS.has(tool)) return invalid;
  let before = "";
  try {
    before = asLf(readFileSync(found.file, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      return "cannot be read, so the guard cannot tell what this call would change";
    }
  }
  const after = textAfter(tool, input, before);
  const next = after === null ? undefined : parseJson(after);
  if (!isObject(next)) return invalid;
  const previous = parseJson(before);
  const old = isObject(previous) ? previous : {}; // a file that does not parse registers nothing
  const [had, has] = [guardEntries(old), guardEntries(next)];
  const kept = had.length === has.length && had.every((entry, i) => entry === has[i]);
  const installed = had.length === 0 && has.length === 1 && has[0] === INSTALLED;
  if (!kept && !installed) return "would remove or change the guard's PreToolUse entry";
  if (next.disableAllHooks !== undefined && next.disableAllHooks !== false) {
    return "would set disableAllHooks, which switches the guard off";
  }
  const [env, was] = [guardedEnv(next, found.user), guardedEnv(old, found.user)];
  if (canonicalJson(env) === canonicalJson(was)) return undefined;
  return found.user
    ? "would change PATH, NODE_OPTIONS or another NODE_* entry of env, which steer the guard's " +
        "interpreter"
    : "would change the env key";
}

// --- The hook ---------------------------------------------------------------------------------

/** On Windows, whether a file tool's path names an NTFS stream: a : after the drive letter. */
const namesStream = (path) =>
  process.platform === "win32" &&
  slashes(stripDevice(path.trim())).replace(/^[a-z]:/i, "").includes(":");

/** On Windows, whether a file tool's path is a UNC share or a \\.\ / \\?\UNC\ device path. */
const namesDevice = (path) => process.platform === "win32" && DEVICE_OR_UNC.test(path.trim());

/** The message that blocks a file tool's call on `raw` (file_path when `isFilePath`), if any. */
function fileVerdict(tool, input, raw, isFilePath, ctx) {
  const expanded = expand(raw.trim(), ctx.dir, ctx);
  if (namesStream(expanded)) {
    return (
      `${PREFIX}${raw} is an unsafe path: a : after the drive letter names an NTFS data stream ` +
      "(file::$DATA is the file itself), which the guard does not follow. Name the file without it."
    );
  }
  if (namesDevice(expanded)) {
    return (
      `${PREFIX}${raw} is an unsafe path: a UNC share (\\\\server\\share) or a \\\\.\\ or ` +
      "\\\\?\\UNC\\ device path keeps its form through realpath, so the guard cannot canonicalise " +
      "it and does not follow it. Name the file by a local path under the repository."
    );
  }
  const cased = resolveCased(raw, ctx.dir, ctx);
  for (const full of unique([cased.toLowerCase(), canonical(cased)?.toLowerCase()])) {
    const found = classifyFull(full, ctx, false);
    if (found === undefined) continue;
    if (found.rule === "hooks") return `${PREFIX}${raw} is under .claude/hooks/. ${HOOKS_RULE}`;
    if (found.rule === "gitdir") return `${PREFIX}${raw} is part of the repository's .git. ${GITDIR_RULE}`;
    if (found.rule === "settings") {
      const why = settingsVerdict(tool, input, isFilePath, found);
      if (why !== undefined) return `${PREFIX}${raw} ${why}. ${SETTINGS_RULE}`;
      continue;
    }
    // A frozen path: the spec may pass when only its Test cells change.
    if (isFilePath && found.spec !== null && testCellsOnly(tool, input, found.spec)) continue;
    return `${PREFIX}${raw} is a frozen pipeline artifact. ${LADDER}`;
  }
  const linked = hardLinked(cased, ctx);
  if (linked !== undefined) {
    return (
      `${PREFIX}${raw} is a hard link to ${linked}, which the guard protects: writing one name ` +
      `writes the other. ${LADDER}`
    );
  }
  return undefined;
}

/** The message that blocks the call, or undefined to let it run. */
function decide(stdin) {
  let call = null;
  try {
    call = JSON.parse(stdin.charCodeAt(0) === 0xfeff ? stdin.slice(1) : stdin);
  } catch {
    // Not JSON: handled below, with every other payload that is not an object.
  }
  if (!isObject(call)) return MALFORMED;
  const { tool_name: tool, tool_input: input } = call;
  const cwd = typeof call.cwd === "string" && call.cwd !== "" ? call.cwd : process.cwd();
  // The cwd and the project as spelled: paths keep their case, and compare in lower case.
  const start = tidy(cwd);
  const project = tidy(process.env.CLAUDE_PROJECT_DIR || cwd);
  const built = buildRoot(project, start);
  const cased = [start, project];
  let roots;
  try {
    const paths = built.toLowerCase() === project.toLowerCase() ? [built] : [built, project];
    roots = paths.map((path) => repository(path, cased));
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return (
      `${PREFIX}${RATCHET_FILE} cannot be read (${error.message}), so the guard cannot tell ` +
      "which agents are frozen and fails closed. The owner repairs it from their own terminal: " +
      'one agent prefix per line, "." for the repository root, agents/<domain>/<bot>/ otherwise.'
    );
  }
  const userFile = `${tidy(homedir())}/${USER_SETTINGS}`;
  const ctx = {
    roots,
    project,
    drives: /^[a-z]:/i.test(built),
    dir: start,
    dirs: [start],
    unsure: false,
    chainReliable: true,
    tool,
    anyFrozen: roots.some((root) => root.agents.some((agent) => agent.frozen)),
    userFile,
    userSettings: unique([userFile.toLowerCase(), canonical(userFile)?.toLowerCase()]),
  };
  if (!isObject(input)) return undefined;
  if (FILE_TOOLS.has(tool)) {
    for (const [at, raw] of [input.file_path, input.notebook_path].entries()) {
      if (typeof raw !== "string" || raw.trim() === "") continue;
      // file_path (at 0) may be the spec, changed in its Test cells only, or a settings file.
      const blocked = fileVerdict(tool, input, raw, at === 0, ctx);
      if (blocked !== undefined) return blocked;
    }
  }
  if (SHELL_TOOLS.has(tool) && typeof input.command === "string") {
    const hit = shellWrite(input.command, ctx);
    if (hit !== undefined) return shellMessage(hit);
  }
  return undefined;
}

let verdict;
try {
  const chunks = [];
  try {
    for await (const chunk of process.stdin) chunks.push(chunk);
  } catch {
    // A closed or unreadable stdin reads as empty, which is not a tool call.
  }
  verdict = decide(Buffer.concat(chunks).toString("utf8"));
} catch (error) {
  verdict =
    `${PREFIX}the guard failed on this call (${error}) and fails closed ` +
    `(guard ${GUARD_VERSION}).`;
}
if (verdict !== undefined) {
  process.stderr.write(`${verdict}\n`);
  process.exitCode = 2;
}
