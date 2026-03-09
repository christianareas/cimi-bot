// --------------------------------------------------------------------------------
// Dependencies.
// --------------------------------------------------------------------------------

import { randomBytes } from "node:crypto"
import { google } from "googleapis"

// --------------------------------------------------------------------------------
// Google Auth.
// --------------------------------------------------------------------------------

const auth = new google.auth.JWT({
	email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
	key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
	scopes: [
		"https://www.googleapis.com/auth/admin.directory.user",
		"https://www.googleapis.com/auth/admin.directory.group",
		"https://www.googleapis.com/auth/gmail.send",
	],
	subject: process.env.GOOGLE_ADMIN_EMAIL,
})

const adminSdk = google.admin({ version: "directory_v1", auth })
const gmail = google.gmail({ version: "v1", auth })

// --------------------------------------------------------------------------------
// Create user.
// --------------------------------------------------------------------------------

export async function createGoogleUser(params: {
	firstName: string
	lastName: string
	officialEmail: string
}): Promise<string> {
	const temporaryPassword = randomBytes(8).toString("hex")

	await adminSdk.users.insert({
		requestBody: {
			name: {
				givenName: params.firstName,
				familyName: params.lastName,
			},
			primaryEmail: params.officialEmail,
			password: temporaryPassword,
			changePasswordAtNextLogin: true,
		},
	})

	return temporaryPassword
}

// --------------------------------------------------------------------------------
// Add user to group.
// --------------------------------------------------------------------------------

export async function addUserToGroup(
	userEmail: string,
	groupEmail: string,
): Promise<void> {
	await adminSdk.members.insert({
		groupKey: groupEmail,
		requestBody: {
			email: userEmail,
			role: "MEMBER",
		},
	})
}

// --------------------------------------------------------------------------------
// Send welcome email.
// --------------------------------------------------------------------------------

export async function sendWelcomeEmail(params: {
	firstName: string
	personalEmail: string
	officialEmail: string
	temporaryPassword: string
}): Promise<void> {
	const body = [
		`Hi ${params.firstName},`,
		``,
		`Welcome to CIMI!`,
		``,
		`To sign into your new account, go to:`,
		``,
		`https://mail.google.com/mail`,
		``,
		`Sign in with your new email and temporary password:`,
		``,
		params.officialEmail,
		params.temporaryPassword,
		``,
		`Thank you for joining the team,`,
		``,
		`CIMI`,
		``,
		`P.S. If you need help, reach out to ${process.env.GOOGLE_ADMIN_EMAIL}.`,
	].join("\n")

	const message = [
		`To: ${params.personalEmail}`,
		`From: ${process.env.GOOGLE_ADMIN_EMAIL}`,
		`Subject: Welcome to CIMI!`,
		`Content-Type: text/plain; charset=utf-8`,
		``,
		body,
	].join("\n")

	const encoded = Buffer.from(message).toString("base64url")

	await gmail.users.messages.send({
		userId: "me",
		requestBody: { raw: encoded },
	})
}

// --------------------------------------------------------------------------------
