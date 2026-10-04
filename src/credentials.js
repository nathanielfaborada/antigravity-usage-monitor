let native;

function readAccessToken() {
  if (process.platform !== 'win32') {
    throw new Error('Silent API login access currently supports Windows.');
  }
  if (!native) {
    const koffi = require('koffi');
    const credentialType = koffi.struct('QuotaMonitorCredential', {
      Flags: 'uint32', Type: 'uint32', TargetName: 'void *', Comment: 'void *',
      LastWritten: koffi.array('uint32', 2), CredentialBlobSize: 'uint32',
      CredentialBlob: 'void *', Persist: 'uint32', AttributeCount: 'uint32',
      Attributes: 'void *', TargetAlias: 'void *', UserName: 'void *'
    });
    const library = koffi.load('advapi32.dll');
    native = {
      koffi, credentialType,
      read: library.func('int __stdcall CredReadW(const char16_t *target, uint32 type, uint32 flags, _Out_ void **credential)'),
      free: library.func('void __stdcall CredFree(void *credential)')
    };
  }
  const pointer = [null];
  if (!native.read('gemini:antigravity', 1, 0, pointer)) {
    throw new Error('Antigravity login not found. Sign in using Antigravity, then refresh.');
  }
  let bytes;
  try {
    const credential = native.koffi.decode(pointer[0], native.credentialType);
    if (!credential.CredentialBlob || credential.CredentialBlobSize > 65536) {
      throw new Error('Invalid credential format');
    }
    bytes = Buffer.from(native.koffi.decode(credential.CredentialBlob, 'uint8', credential.CredentialBlobSize));
    const stored = JSON.parse(bytes.toString('utf8'));
    const token = stored.token || stored;
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Missing token');
    // Re-read the credential on each request so account changes aren't cached.
    return token.access_token;
  } catch {
    throw new Error('Unable to read Antigravity login. Sign in again, then refresh.');
  } finally {
    if (bytes) bytes.fill(0);
    native.free(pointer[0]);
  }
}

module.exports = { readAccessToken };
