// frontend/src/lib/crypto.ts

const ALGO_NAME = "ECDH";
const CURVE = "P-256";
const AES_ALGO = "AES-GCM";
const DB_NAME = "E2EE_PandaHub";
const STORE_NAME = "keys";

// IndexedDB helpers for storing the private key
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePrivateKey(privateKey: CryptoKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(privateKey, "privateKey");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPrivateKey(): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get("privateKey");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Crypto operations
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    { name: ALGO_NAME, namedCurve: CURVE },
    true, // extractable
    ["deriveKey", "deriveBits"]
  );
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", publicKey);
  const bytes = new Uint8Array(exported);
  return btoa(String.fromCharCode(...bytes));
}

export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    { name: ALGO_NAME, namedCurve: CURVE },
    true,
    []
  );
}

// Derive a shared symmetric AES-GCM key from our private key + their public key
async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: ALGO_NAME,
      public: publicKey,
    },
    privateKey,
    { name: AES_ALGO, length: 256 },
    false, // derived key is not extractable
    ["encrypt", "decrypt"]
  );
}

// Returns base64 encoded ciphertext and base64 encoded iv
export async function encryptMessage(text: string, ourPrivateKey: CryptoKey, theirPublicKeyBase64: string): Promise<{ ciphertext: string, iv: string }> {
  const theirPublicKey = await importPublicKey(theirPublicKeyBase64);
  const sharedKey = await deriveSharedKey(ourPrivateKey, theirPublicKey);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encoded = new TextEncoder().encode(text);
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: AES_ALGO, iv },
    sharedKey,
    encoded
  );
  
  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return { ciphertext: ciphertextBase64, iv: ivBase64 };
}

export async function decryptMessage(ciphertextBase64: string, ivBase64: string, ourPrivateKey: CryptoKey, theirPublicKeyBase64: string): Promise<string> {
  const theirPublicKey = await importPublicKey(theirPublicKeyBase64);
  const sharedKey = await deriveSharedKey(ourPrivateKey, theirPublicKey);
  
  const ivStr = atob(ivBase64);
  const iv = new Uint8Array(ivStr.length);
  for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);
  
  const cipherStr = atob(ciphertextBase64);
  const ciphertext = new Uint8Array(cipherStr.length);
  for (let i = 0; i < cipherStr.length; i++) ciphertext[i] = cipherStr.charCodeAt(i);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: AES_ALGO, iv },
    sharedKey,
    ciphertext
  );
  
  return new TextDecoder().decode(decryptedBuffer);
}
