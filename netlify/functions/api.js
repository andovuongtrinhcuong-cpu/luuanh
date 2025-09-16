const fetch = require('node-fetch');

// This function is a generic proxy for the GitHub API.
// It handles authentication and forwards requests, keeping the token secure.
exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
            },
        };
    }
    
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { username, password, method, githubPath, body } = JSON.parse(event.body);

    const { APP_USER, APP_PASS, GITHUB_TOKEN, GITHUB_REPO } = process.env;

    if (!APP_USER || !APP_PASS || !GITHUB_TOKEN || !GITHUB_REPO) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Server is not configured correctly.'}) };
    }

    // Authenticate the user
    if (username !== APP_USER || password !== APP_PASS) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const url = `https://api.github.com/repos/${GITHUB_REPO}${githubPath}`;

    const options = {
      method: method,
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
        return { statusCode: 204, body: '' };
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        return { statusCode: response.status, body: JSON.stringify(data) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};
