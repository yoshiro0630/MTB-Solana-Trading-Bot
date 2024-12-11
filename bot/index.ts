import { Context, Telegraf, Markup } from "telegraf";
import { session } from "telegraf";
import dotenv from "dotenv";
import axios from "axios";
import { getTokenData, getTokenAccounts, connection, getSolBalance } from "./web3";
import { apiSwap } from "./swap";
import { BotContext } from "./types";

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000/";
console.log("BACKEND_URL=============>", BACKEND_URL);

const botToken = "7912313639:AAHWVJxqGdfpGnV2vLMQ87eS-fhs7-fbplk";
const bot = new Telegraf(botToken);

bot.use(session());

bot.start(async (ctx: BotContext) => {
    const chatId = ctx.chat?.id;
    const username = ctx.from?.username;

    if (!ctx.session) ctx.session = {};

    ctx.session.user = await fetchUser(chatId, username);

    ctx.session.walletBalances = await getTokenAccounts(ctx.session.user.wallets[0].publicKey, connection);
    ctx.session.solBalance = await getSolBalance(ctx.session.user.wallets[0].publicKey);

    let text: string = `SOL Balance: ${ctx.session.solBalance} SOL\n\n`;

    if (ctx.session.walletBalances.length == 0) {
        text += "No other tokens found";
    } else {
        ctx.session.walletBalances.forEach((item) => {
            text += `Token Name: ${item.tokenName}\nToken Address: ${item.tokenAddress}\nToken Balance: ${item.tokenBalance}\n\n`;
        });
    }

    ctx.session.tokenIndex = 0;

    const inline_keyboard = getStartCaption();

    ctx.reply(`${ctx.session.user.wallets[0].publicKey}\n\n${text}`, inline_keyboard);
});

// CallBack Logics

bot.action("buy_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    console.log("CTX Session===========>", ctx.session);
    ctx.session.selectedMode = "swap";
    ctx.reply(
        "Please input the token address you want to buy:",
        Markup.inlineKeyboard([[Markup.button.callback("Cancel", "cl_cmd")]])
    );
    ctx.session.messageStatus = "buy";
});

// bot.action("swap_cmd", async (ctx: BotContext) => {
//     ctx.reply(
//         `How much are you going to Buy?\n${ctx.session?.tokenToBuy?.name} | ${ctx.session?.tokenToBuy?.symbol} | ${ctx.session?.tokenToBuy?.address}\n\nPrice: $${ctx.session?.tokenToBuy?.price_usd}\nMarketCap: ${ctx.session?.tokenToBuy?.market_cap_usd}`,
//         Markup.inlineKeyboard([
//             [
//                 Markup.button.callback("Buy 1.0 SOL", "buy_10"),
//                 Markup.button.callback("Buy 0.5 SOL", "buy_05"),
//                 Markup.button.callback("Buy X SOL", "buy_x"),
//             ],
//             [Markup.button.callback("Cancel", "cl_cmd")],
//         ])
//     );
// });

bot.action("swap_opt", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.selectedMode = "swap";
    const replyMarkup =
        ctx.session.walletBalances?.length === 0
            ? getSwapLimitCaption(ctx.session.selectedMode)
            : getBuyLimitSellCaption(ctx.session.selectedMode);
    await ctx.editMessageReplyMarkup({ inline_keyboard: replyMarkup });
});

bot.action("cl_cmd", async (ctx: BotContext) => {
    ctx.deleteMessage();
});

// Message Response Logics

bot.on("text", async (ctx: BotContext) => {
    const input = ctx.text;
    console.log("CTX Message============>", input);

    if (ctx.session?.messageStatus == "buy") {
        const tokenAddress = input;
        const tokenData = await getTokenData(tokenAddress);
        if (tokenData) {
            ctx.session.tokenToBuy = tokenData;
            const inline_keyboard =
                ctx.session.walletBalances?.length === 0
                    ? getSwapLimitCaption(ctx.session.selectedMode)
                    : getBuyLimitSellCaption(ctx.session.selectedMode);
            ctx.reply(
                `${tokenData.name} | ${tokenData.symbol} | ${tokenData.address}\n\nPrice: $${tokenData.price_usd}\nMarketCap: ${tokenData.market_cap_usd}`,
                { inline_keyboard: inline_keyboard }
            );
        } else {
            ctx.reply(`Token address ${tokenAddress} not found`);
        }
    } else {
        return;
    }
});

const fetchUser = async (userId: Number | undefined, username: String | undefined) => {
    const response = await axios.post(`${BACKEND_URL}api/users`, {
        userId: userId,
        username: username,
    });
    // console.log(response.data);
    return response.data;
};

// Define Inline Keyboards

const getStartCaption = () => {
    return [
        [Markup.button.callback("Buy", "buy_cmd"), Markup.button.callback("Sell & Manage", "sell_cmd")],
        [Markup.button.callback("Wallets", "wallets_cmd"), Markup.button.callback("Settings", "settings_cmd")],
        [Markup.button.callback("Help", "help_cmd")],
        [Markup.button.callback("Pin", "pin_cmd"), Markup.button.callback("Refresh", "refresh_cmd")],
    ];
};

const getSwapLimitCaption = (mode?: "swap" | "limit") => {
    return [
        [Markup.button.callback("Cancel", "cl_cmd")],
        [
            Markup.button.callback(mode === "swap" ? "✅ Swap" : "Swap", "swap_opt"),
            Markup.button.callback(mode === "limit" ? "✅ Limit" : "Swap", "limit_opt"),
        ],
        ...(mode === "swap"
            ? [
                  [
                      Markup.button.callback("Buy 1.0 SOL", "buy_10"),
                      Markup.button.callback("Buy 0.5 SOL", "buy_05"),
                      Markup.button.callback("Buy X SOL", "buy_x"),
                  ],
              ]
            : [
                  [
                      Markup.button.callback("Limit Buy 5.0 SOL", "limit_50"),
                      Markup.button.callback("Limit Buy X SOL", "limit_x"),
                  ],
              ]),
        [Markup.button.callback("Refresh", "refresh_cmd")],
    ];
};

const getBuyLimitSellCaption = (mode?: "swap" | "limit") => {
    return [
        [Markup.button.callback("Home", "home_cmd"), Markup.button.callback("Close", "cl_cmd")],
        [
            Markup.button.callback(mode === "swap" ? "✅ Swap" : "Swap", "swap_opt"),
            Markup.button.callback(mode === "limit" ? "✅ Limit" : "Limit", "limit_opt"),
        ],
        ...(mode === "swap"
            ? [
                  [
                      Markup.button.callback("Buy 1.0 SOL", "buy_10"),
                      Markup.button.callback("Buy 0.5 SOL", "buy_05"),
                      Markup.button.callback("Buy X SOL", "buy_x"),
                  ],
                  [
                      Markup.button.callback("Prev", "prev_opt"),
                      Markup.button.callback("Token To Buy", "no_cmd"),
                      Markup.button.callback("Next", "next_opt"),
                  ],
                  [
                      Markup.button.callback("Sell 25%", "sell_25"),
                      Markup.button.callback("Sell 100%", "sell_100"),
                      Markup.button.callback("Sell X %", "sell_x"),
                  ],
              ]
            : [
                  [
                      Markup.button.callback("Limit Buy 5.0 SOL", "limit_50"),
                      Markup.button.callback("Limit Buy X SOL", "limit_x"),
                  ],
                  [
                      Markup.button.callback("Prev", "prev_opt"),
                      Markup.button.callback("Token To Buy", "no_cmd"),
                      Markup.button.callback("Next", "next_opt"),
                  ],
                  [
                      Markup.button.callback("Limit Sell 25%", "limit_sell_25"),
                      Markup.button.callback("Limit Sell X %", "limit_sell_x"),
                  ],
              ]),
        [Markup.button.callback("Refresh", "refresh_cmd")],
    ];
};

// Start the bot
bot.launch()
    .then(() => {
        console.log("Bot is running...");
    })
    .catch((error) => {
        console.error("Error starting bot:", error);
    });

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
