/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_TITLE: string;
    // more env variables...
    readonly JSONBIN_MASTER_KEY?: string;
    readonly JSONBIN_BIN_ID?: string;
    readonly TINYMCE_API_KEY?: string;
    readonly ADMIN_PASSPHRASE?: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }