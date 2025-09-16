const fetch = require("node-fetch");
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
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  const user = verifyToken(event);
  if (!user) {
      return { statusCode: 401, body: JSON.stringify({ message: "Unauthorized" }) };
  }

  try {
    const { path, content } = JSON.parse(event.body);

    if (!path || !content) {
        return { statusCode: 400, body: JSON.stringify({ message: "Missing path or content" }) };
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO = "andovuongtrinhcuong-cpu/luuanh";
    const BRANCH = "main";

    const url = `https://api.github.com/repos/${REPO}/contents/${path}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `feat: upload ${path}`,
        content: content,
        branch: BRANCH,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
        return { statusCode: response.status, body: JSON.stringify(data) };
    }
    
    return { statusCode: response.status, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};
