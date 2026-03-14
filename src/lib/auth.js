import { jwtVerify, SignJWT } from 'jose';
import bcrypt from 'bcryptjs';

const getJwtSecretKey = () => {
	const secret = process.env.JWT_SECRET_KEY;
	if (!secret || secret.length === 0) {
		// Gunakan default saat development jika tidak ada di .env (Opsional)
		return 'super-secret-key-guru-app-antigravity';
	}
	return secret;
};

export const verifyAuth = async (token) => {
	try {
		const verified = await jwtVerify(token, new TextEncoder().encode(getJwtSecretKey()));
		return verified.payload;
	} catch (err) {
		throw new Error('Your token has expired or is invalid.');
	}
};

export const createToken = async (payload) => {
	const iat = Math.floor(Date.now() / 1000);
	const exp = iat + 60 * 60 * 24; // 24 Jam

	return new SignJWT({ ...payload }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setExpirationTime(exp).setIssuedAt(iat).setNotBefore(iat).sign(new TextEncoder().encode(getJwtSecretKey()));
};

export const hashPassword = async (password) => {
	const saltRounds = 10;
	return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password, hash) => {
	return await bcrypt.compare(password, hash);
};
