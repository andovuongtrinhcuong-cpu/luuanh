const fetch = require('node-fetch');

// This function handles the file upload.
// It authenticates using app-specific credentials and uses a backend GitHub token.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { username, password, path, content } = JSON.parse(event.body);

    const { APP_USER, APP_PASS, GITHUB_TOKEN, GITHUB_REPO } = process.env;

    if (!APP_USER || !APP_PASS || !GITHUB_TOKEN || !GITHUB_REPO) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Server is not configured correctly.' }) };
    }

    // Authenticate the user
    if (username !== APP_USER || password !== APP_PASS) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `feat: Add image ${path.split('/').pop()}`,
        content: content, // base64 encoded
      }),
    });
    
    const data = await response.json();

    if (!response.ok) {
        return { statusCode: response.status, body: JSON.stringify(data) };
    }

    return {
      statusCode: 201,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};
