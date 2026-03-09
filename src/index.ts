// --------------------------------------------------------------------------------
// Dependencies.
// --------------------------------------------------------------------------------

import "dotenv/config"
import { App } from "@slack/bolt"
import { registerCreateGoogleAccount } from "./commands/createGoogleAccount.ts"

// --------------------------------------------------------------------------------
// Initialize the Slack app.
// --------------------------------------------------------------------------------

const app = new App({
	signingSecret: process.env.SLACK_SIGNING_SECRET,
	appToken: process.env.SLACK_APP_TOKEN,
	token: process.env.SLACK_BOT_TOKEN,
	socketMode: true,
})

// --------------------------------------------------------------------------------
// Register the Slack commands.
// --------------------------------------------------------------------------------

registerCreateGoogleAccount(app)

// --------------------------------------------------------------------------------
// Start the Slack app.
// --------------------------------------------------------------------------------

await app.start()
console.log("CIMI Bot’s ready. 🤖")

// --------------------------------------------------------------------------------
