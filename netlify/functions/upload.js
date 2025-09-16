const fetch = require("node-fetch");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { username, password, filename, content } = JSON.parse(event.body);

    // ✅ Lấy danh sách user/pass từ ENV
    const users = JSON.parse(process.env.APP_USERS || "[]");

    // Kiểm tra đăng nhập
    const valid = users.some(
      (u) => u.user === username && u.pass === password
    );

    if (!valid) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    // ✅ Token GitHub (ẩn trong Netlify)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO = "andovuongtrinhcuong-cpu/luuanh"; // 👉 sửa tên repo của bạn
    const BRANCH = "main";

    const url = `https://api.github.com/repos/${REPO}/contents/${filename}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `upload ${filename}`,
        content: content, // base64 encode
        branch: BRANCH,
      }),
    });

    const data = await response.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
