'use strict';

const YouTube = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest';

  let gapiReady = false;
  let gsiReady = false;
  let tokenClient = null;
  let accessToken = null;
  let currentUser = null;

  const gapiReadyPromise = new Promise(resolve => {
    window._gapiResolve = resolve;
  });
  const gsiReadyPromise = new Promise(resolve => {
    window._gsiResolve = resolve;
  });

  window.onGapiLoad = () => {
    gapi.load('client', async () => {
      gapiReady = true;
      window._gapiResolve();
    });
  };

  window.onGsiLoad = () => {
    gsiReady = true;
    window._gsiResolve();
  };

  async function initClient(clientId) {
    await gapiReadyPromise;
    await gapi.client.init({
      discoveryDocs: [DISCOVERY_DOC],
    });
    await gsiReadyPromise;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          console.error('Token error:', resp.error);
          return;
        }
        accessToken = resp.access_token;
        gapi.client.setToken({ access_token: accessToken });
        if (window._tokenResolve) {
          window._tokenResolve(resp);
          window._tokenResolve = null;
        }
      },
    });
  }

  function requestToken() {
    return new Promise((resolve, reject) => {
      window._tokenResolve = resolve;
      window._tokenReject = reject;
      if (accessToken) {
        gapi.client.setToken({ access_token: accessToken });
        resolve({ access_token: accessToken });
        return;
      }
      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  function signIn() {
    return new Promise((resolve, reject) => {
      window._tokenResolve = async (resp) => {
        try {
          const info = await fetchUserInfo(resp.access_token);
          currentUser = info;
          resolve(info);
        } catch (e) {
          reject(e);
        }
      };
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    currentUser = null;
    gapi.client.setToken(null);
  }

  async function fetchUserInfo(token) {
    const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error('Failed to fetch user info');
    return resp.json();
  }

  async function fetchLikedVideos(onProgress) {
    const videos = [];
    let pageToken = null;
    let page = 0;

    do {
      const params = {
        part: 'snippet,contentDetails',
        myRating: 'like',
        maxResults: 50,
      };
      if (pageToken) params.pageToken = pageToken;

      let resp;
      try {
        resp = await gapi.client.youtube.videos.list(params);
      } catch (e) {
        if (e.status === 401) {
          accessToken = null;
          gapi.client.setToken(null);
          await requestToken();
          resp = await gapi.client.youtube.videos.list(params);
        } else {
          throw e;
        }
      }

      const result = resp.result;
      if (!result.items) break;

      result.items.forEach(item => {
        videos.push({
          videoId: item.id,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          description: item.snippet.description || '',
          publishedAt: item.snippet.publishedAt,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
          duration: parseDuration(item.contentDetails?.duration || ''),
          tags: item.snippet.tags || [],
          fetchedAt: new Date().toISOString(),
        });
      });

      page++;
      if (onProgress) onProgress(videos.length);
      pageToken = result.nextPageToken || null;
    } while (pageToken);

    return videos;
  }

  function parseDuration(iso) {
    if (!iso) return '';
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return '';
    const h = parseInt(m[1] || 0);
    const min = parseInt(m[2] || 0);
    const sec = parseInt(m[3] || 0);
    if (h > 0) {
      return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  function isSignedIn() {
    return !!accessToken;
  }

  function getUser() {
    return currentUser;
  }

  function setUser(user) {
    currentUser = user;
  }

  function setToken(token) {
    accessToken = token;
    if (token) gapi.client.setToken({ access_token: token });
  }

  return {
    initClient,
    signIn,
    signOut,
    fetchLikedVideos,
    isSignedIn,
    getUser,
    setUser,
    setToken,
    requestToken,
  };
})();
