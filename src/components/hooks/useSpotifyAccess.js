import React from "react";
import { generateId } from '@/utils/random';

function useSpotifyAccess() {

  function checkLinkForError(link) {
    const urlParams = new URLSearchParams(link.split('?')[1]);

    if (urlParams.has('error')) {
      const error = urlParams.get('error');
      return error;
    }

    return null;
  }

  function processValidLink(link) {
    const urlParams = new URLSearchParams(link.split('?')[1])
    let code, state;

    if (urlParams.has('code')) {
      code = urlParams.get('code');
    }

    if (urlParams.has('state')) {
      state = urlParams.get('state')
    }

    if (!code || !state) {
      return null;
    }

    return {code: code, state: state}
  }

  async function generateAuthorizationCode() {
    try {
      const state = generateId(16);
      const scope = 'user-read-playback-state user-modify-playback-state user-read-email';

      const authorizeUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
        scope: scope,
        redirect_uri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI,
        state: state
      })}`;

      window.location.href = authorizeUrl;
      return state;
    } catch (err) {
      return null;
    }
  }

  async function requestAccessToken() {
    const state = await generateAuthorizationCode();
    if (!state) {
    }
  }

  return {
    checkLinkForError: checkLinkForError,
    processValidLink: processValidLink,
    generateAuthorizationCode: generateAuthorizationCode,
    requestAccessToken: requestAccessToken
  };
}

export default useSpotifyAccess