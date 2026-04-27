import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Open a native OS folder-picker dialog and return the chosen absolute path,
 * or null if the user cancelled.
 */
export async function pickFolderNative(prompt: string): Promise<string | null> {
  switch (process.platform) {
    case 'darwin':
      return pickMac(prompt);
    case 'linux':
      return pickLinux(prompt);
    case 'win32':
      return pickWindows(prompt);
    default:
      throw new Error(`Native folder picker not supported on ${process.platform}`);
  }
}

async function pickMac(prompt: string): Promise<string | null> {
  // osascript exits non-zero if the user cancels. Catch and return null.
  const script = `POSIX path of (choose folder with prompt "${prompt.replace(/"/g, '\\"')}")`;
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 120_000 });
    const p = stdout.trim();
    return p ? p.replace(/\/$/, '') : null;
  } catch (err: any) {
    if (typeof err?.stderr === 'string' && /User canceled|-128/.test(err.stderr)) return null;
    throw err;
  }
}

async function pickLinux(prompt: string): Promise<string | null> {
  // zenity is the most widely available; fail clearly if it's not installed.
  try {
    const { stdout } = await execFileAsync('zenity', ['--file-selection', '--directory', `--title=${prompt}`], { timeout: 120_000 });
    const p = stdout.trim();
    return p || null;
  } catch (err: any) {
    if (err?.code === 1) return null; // user cancelled
    if (err?.code === 'ENOENT') {
      throw new Error('zenity is not installed; install zenity (or use the manual path field).');
    }
    throw err;
  }
}

async function pickWindows(prompt: string): Promise<string | null> {
  const escaped = prompt.replace(/'/g, "''");
  const ps = [
    'Add-Type -AssemblyName System.Windows.Forms;',
    '$f = New-Object System.Windows.Forms.FolderBrowserDialog;',
    `$f.Description = '${escaped}';`,
    `if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }`,
  ].join(' ');
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { timeout: 120_000 });
  const p = stdout.trim();
  return p || null;
}
