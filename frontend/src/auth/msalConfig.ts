// Opprettet av Sm-Oslomet
// lagd for å sette opp autentisering

import { PublicClientApplication } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_AAD_CLIENT_ID as string;
const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string;

export const msalConfig = {
    auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
    }
};

export const loginRequest = {
    scopes: [`api://${clientId}/access_as_user`]
};

export const msalInstance = new PublicClientApplication(msalConfig);

// written by sm-dev
