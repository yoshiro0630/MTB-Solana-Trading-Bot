import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { NewMessageEvent } from "telegram/events";
import fs from "fs";
import readline from "readline";

const apiId = 11682918;
const apiHash = "8d78b2d673ec4a66ad7558f9b123da06";
const sessionFilePath = './session.txt'; // Path to save the session string

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

export async function startTelegramClient( channel: string[]) {
    let stringSession = new StringSession("");

    // Load the session string from the file if it exists
    if (fs.existsSync(sessionFilePath)) {
        const savedSession = fs.readFileSync(sessionFilePath, 'utf-8');
        stringSession = new StringSession(savedSession);
    }

    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () =>
            new Promise((resolve) =>
                rl.question("Please enter your number: ", resolve)
            ),
        password: async () =>
            new Promise((resolve) =>
                rl.question("Please enter your password: ", resolve)
            ),
        phoneCode: async () =>
            new Promise((resolve) =>
                rl.question("Please enter the code you received: ", resolve)
            ),
        onError: (err) => console.log(err),
    });

    console.log("You should now be connected.");
    console.log(client.session.save()); // Save this string to avoid logging in again

    // Save the session string to a file
    fs.writeFileSync(sessionFilePath, `${client.session.save()}`);

    // Start listening for new messages in a specific channel
    // const channel = 'mtbbotchanneltest'; // Replace with your channel username or ID
    async function handler(event: NewMessageEvent) {
        console.log(event.message.message);
    }

    client.addEventHandler(handler, new NewMessage({ chats: channel }));
}