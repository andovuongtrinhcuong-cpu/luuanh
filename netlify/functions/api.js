const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

const verifyToken = (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return null;
    }
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const user = verifyToken(event);
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    try {
        const { method, githubPath, body } = JSON.parse(event.body);

        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const REPO = 'andovuongtrinhcuong-cpu/luuanh';
        const url = `https://api.github.com/repos/${REPO}${githubPath}`;

        const options = {
            method: method,
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (response.status === 204) {
            return { statusCode: 204 };
        }
        
        const responseBody = await response.text();
        const headers = {
            'Content-Type': response.headers.get('content-type') || 'application/json'
        };

        return {
            statusCode: response.status,
            headers,
            body: responseBody,
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};
