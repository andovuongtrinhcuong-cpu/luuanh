const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { user, pass } = JSON.parse(event.body);

        if (!user || !pass) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Username and password are required.' }) };
        }

        const users = JSON.parse(process.env.APP_USERS || '[]');
        const validUser = users.find(u => u.user === user && u.pass === pass);

        if (!validUser) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials' }) };
        }
        
        if (!process.env.JWT_SECRET) {
             throw new Error('JWT_SECRET environment variable not set.');
        }

        const token = jwt.sign({ user: validUser.user }, process.env.JWT_SECRET, { expiresIn: '8h' });

        return {
            statusCode: 200,
            body: JSON.stringify({ token }),
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};
