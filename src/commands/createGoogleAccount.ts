// --------------------------------------------------------------------------------
// Dependencies.
// --------------------------------------------------------------------------------

import type { App } from "@slack/bolt"
import {
	addUserToGroup,
	createGoogleUser,
	sendWelcomeEmail,
} from "../services/google.ts"

// --------------------------------------------------------------------------------
// Constants.
// --------------------------------------------------------------------------------

const callbackId = "create_google_account_modal"
const domain = "runwithcimi.org"

const googleGroups = [
	{
		label: "Team",
		email: `team@${domain}`,
	},
	{
		label: "Board",
		email: `board@${domain}`,
	},
]

// --------------------------------------------------------------------------------
// Slack command.
// --------------------------------------------------------------------------------

export function registerCreateGoogleAccount(app: App): void {
	app.command(
		"/create-google-account",
		async ({ ack, respond, client, body }) => {
			await ack()

			if (body.channel_id !== process.env.SLACK_ALLOWED_CHANNEL_ID) {
				await respond({
					response_type: "ephemeral",
					text: "You can only use this command in the #cimi-bot channel.",
				})
				return
			}

			await client.views.open({
				trigger_id: body.trigger_id,
				view: {
					...buildModal(),
					private_metadata: body.channel_id,
				},
			})
		},
	)

	// --------------------------------------------------------------------------------
	// View submission.
	// --------------------------------------------------------------------------------

	app.view(callbackId, async ({ ack, view, body, client }) => {
		const v = view.state.values
		const personalEmail = v.personal_email.value.value?.trim() ?? ""
		const username = v.username.value.value?.trim() ?? ""

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
			await ack({
				response_action: "errors",
				errors: {
					personal_email: "Enter a valid email address.",
				},
			})
			return
		}

		if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
			await ack({
				response_action: "errors",
				errors: {
					username:
						"You can only use letters, numbers, dots, hyphens, or underscores.",
				},
			})
			return
		}

		await ack()

		const firstName = v.first_name.value.value ?? ""
		const lastName = v.last_name.value.value ?? ""
		const officialEmail = `${username}@${domain}`
		const groups = v.groups.value.selected_options?.map((o) => o.value) ?? []
		const channelId = view.private_metadata
		const userId = body.user.id

		try {
			const temporaryPassword = await createGoogleUser({
				firstName,
				lastName,
				officialEmail,
			})

			for (const group of groups) {
				await addUserToGroup(officialEmail, group)
			}

			await sendWelcomeEmail({
				firstName,
				personalEmail,
				officialEmail,
				temporaryPassword,
			})

			await client.chat.postEphemeral({
				channel: channelId,
				user: userId,
				text: `Done! Created ${officialEmail} and sent a welcome email to ${personalEmail}.`,
			})
		} catch (error: unknown) {
			const isDuplicate = (error as { code?: number })?.code === 409

			await client.chat.postEphemeral({
				channel: channelId,
				user: userId,
				text: isDuplicate
					? `A Google Workspace account for ${officialEmail} already exists.`
					: `Something went wrong while creating the account. Try again or contact admin@runwithcimi.org.`,
			})
		}
	})
}

// --------------------------------------------------------------------------------
// Slack modal.
// --------------------------------------------------------------------------------

function buildModal() {
	return {
		type: "modal" as const,
		callback_id: callbackId,

		// Title.
		title: {
			type: "plain_text" as const,
			text: "Create Google Account",
		},

		// Fields.
		blocks: [
			// Personal email address.
			{
				type: "input",
				block_id: "personal_email",
				label: {
					type: "plain_text",
					text: "Personal Email Address",
				},
				element: {
					type: "email_text_input",
					action_id: "value",
					placeholder: {
						type: "plain_text",
						text: "someone@gmail.com",
					},
				},
			},

			// First name.
			{
				type: "input",
				block_id: "first_name",
				label: {
					type: "plain_text",
					text: "First Name",
				},
				element: {
					type: "plain_text_input",
					action_id: "value",
				},
			},

			// Last name.
			{
				type: "input",
				block_id: "last_name",
				label: {
					type: "plain_text",
					text: "Last Name",
				},
				element: {
					type: "plain_text_input",
					action_id: "value",
				},
			},

			// Official email address.
			{
				type: "input",
				block_id: "username",
				label: {
					type: "plain_text",
					text: `Official Email Address`,
				},
				element: {
					type: "plain_text_input",
					action_id: "value",
					placeholder: {
						type: "plain_text",
						text: `someone (don’t include @${domain})`,
					},
				},
			},

			// Google groups.
			{
				type: "input",
				block_id: "groups",
				label: {
					type: "plain_text",
					text: "Google Groups",
				},
				optional: true,
				element: {
					type: "multi_static_select",
					action_id: "value",
					placeholder: {
						type: "plain_text",
						text: "Select groups",
					},
					initial_options: [
						{
							text: {
								type: "plain_text",
								text: googleGroups[0].label,
							},
							value: googleGroups[0].email,
						},
					],
					options: googleGroups.map((group) => ({
						text: {
							type: "plain_text",
							text: group.label,
						},
						value: group.email,
					})),
				},
			},
		],

		// Submit and cancel buttons.
		submit: {
			type: "plain_text" as const,
			text: "Create",
		},
		close: {
			type: "plain_text" as const,
			text: "Cancel",
		},
	}
}

// --------------------------------------------------------------------------------
