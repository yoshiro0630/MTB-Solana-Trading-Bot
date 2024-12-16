import { Telegraf, session, Markup } from "telegraf";
import dotenv from "dotenv";
import axios from "axios";
import { getTokenData, getTokenAccounts, connection, getSolBalance } from "./web3";
import { apiSwap } from "./swap";
import { BotContext } from "./types";
import { publicKey } from "@raydium-io/raydium-sdk-v2";

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
    ctx.session.walletIndex = 0;

    const inline_keyboard = getStartCaption();

    ctx.reply(`${ctx.session.user.wallets[0].publicKey}\n\n${text}`, { reply_markup: inline_keyboard });
});

// // CallBack Logics

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

bot.action("swap_cmd", async (ctx: BotContext) => {
    ctx.reply(
        `How much are you going to Buy?\n${ctx.session?.tokenToBuy?.name} | ${ctx.session?.tokenToBuy?.symbol} | ${ctx.session?.tokenToBuy?.address}\n\nPrice: $${ctx.session?.tokenToBuy?.price_usd}\nMarketCap: ${ctx.session?.tokenToBuy?.market_cap_usd}`,
        Markup.inlineKeyboard([
            [
                Markup.button.callback("Buy 1.0 SOL", "buy_10"),
                Markup.button.callback("Buy 0.5 SOL", "buy_05"),
                Markup.button.callback("Buy X SOL", "buy_x"),
            ],
            [Markup.button.callback("Cancel", "cl_cmd")],
        ])
    );
});

bot.action("buy_10", async (ctx: BotContext) => {
    const amount = 1000000000;
    if (ctx.session?.walletIndex || ctx.session?.walletIndex === 0)
        await apiSwap(ctx.session?.tokenToBuy?.address, amount, ctx.session?.user.wallets[ctx.session.walletIndex].secretKey, `${ctx.session?.user.userId}`, true);
});

bot.action("buy_5", async (ctx: BotContext) => {
    const amount = 500000000;
    if (ctx.session?.walletIndex || ctx.session?.walletIndex === 0)
        await apiSwap(ctx.session?.tokenToBuy?.address, amount, ctx.session?.user.wallets[ctx.session.walletIndex].secretKey, `${ctx.session?.user.userId}`, true);
});

bot.action("buy_x", async (ctx: BotContext) => {
    if (!ctx.session) {
        ctx.session = {}; // Initialize session if it doesn't exist
    }
    if (ctx.session?.walletIndex || ctx.session?.walletIndex === 0) {
        ctx.session.solBalance = await getSolBalance(ctx.session?.user.wallets[ctx.session.walletIndex].publicKey);
        if (ctx.session.solBalance === 0) {
            ctx.reply(`Deposit $SOLs your wallet to buy tokens.\nWallet Address: ${ctx.session.user.wallets[ctx.session.walletIndex].publicKey}`);
        } else {
            ctx.session.messageStatus = "buy_x";
            ctx.reply(`Reply with the amount you wish to buy (0 - ${ctx.session.solBalance} SOL, Example: 0.1):`)
        }
    }
});

bot.action("sell_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {}; // Initialize session if it doesn't exist
    if (ctx.session.walletBalances) {
        if (ctx.session.walletBalances?.length > 0) {
            ctx.session.selectedMode = "swap";
            ctx.session.tokenToBuy = {
                address: ctx.session.walletBalances[0].tokenAddress,
                name: ctx.session.walletBalances[0].tokenName
            };
            ctx.reply(
                `Token Name: ${ctx.session.walletBalances[0].tokenName}\nToken Address: ${ctx.session.walletBalances[0].tokenAddress}\nToken Balance: ${ctx.session.walletBalances[0].tokenBalance}\n\n`,
                { reply_markup: { inline_keyboard: getBuyLimitSellCaption(ctx.session.selectedMode) } }
            );
        } else {
            ctx.reply(
                "No position for sell",
                Markup.inlineKeyboard([
                    Markup.button.callback("Cancel", "cl_cmd")
                ])
            );
        }
    }
});

bot.action("sell_25", async (ctx: BotContext) => {
    if (ctx.session?.walletBalances) {
        const percentage = 0.25;
        const tokenAmount = ctx.session.walletBalances[0].tokenBalance * percentage;
        if (ctx.session.walletIndex)
            await apiSwap(
                ctx.session.tokenToBuy?.address,
                tokenAmount,
                ctx.session.user.wallets[ctx.session.walletIndex].secretKey,
                `${ctx.session.user?.userId}`,
                false
            );
    }
});

bot.action("sell_100", async (ctx: BotContext) => {
    if (ctx.session?.walletBalances) {
        const percentage = 1.0;
        const tokenAmount = ctx.session.walletBalances[0].tokenBalance * percentage;
        if (ctx.session.walletIndex)
            await apiSwap(
                ctx.session.tokenToBuy?.address,
                tokenAmount,
                ctx.session.user.wallets[ctx.session.walletIndex].secretKey,
                `${ctx.session.user?.userId}`,
                false
            );
    }
});

bot.action("sell_x", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "sell_x";
    ctx.reply("Reply with the percentage you wish to sell (1-100):");
});

bot.action("limit_cmd", async (ctx: BotContext) => {
    ctx.reply(
        "How much are you going to Limit for buy order?",
        Markup.inlineKeyboard(
            [
                [
                    Markup.button.callback("Limit 5.0 SOL", "limit_50"),
                    Markup.button.callback("Limit X SOL", "limit_x")
                ],
                [
                    Markup.button.callback("Cancel", "cl_cmd")
                ]
            ]
        )
    );
});

bot.action("limit_50", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    const amount = 5.0;
    ctx.session.tempLimitOrders = { amount };
    ctx.session.messageStatus = "limit_market_cap";
    ctx.reply(`Enter the target Market Cap (in USD) for your limit order:\nToken: ${ctx.session.tokenToBuy.name}\nAmount: ${amount} SOL\n\nExample: 1000000 (for $1M market cap)`)
});

bot.action("limit_x", async (ctx: BotContext) => {
    console.log("Limit X command!!!");
    if (!ctx.session) ctx.session = {};
    console.log("walletIndex=============>", ctx.session.walletIndex);
    if (ctx.session.walletIndex || ctx.session.walletIndex === 0) {
        ctx.session.solBalance = await getSolBalance(ctx.session.user.wallets[ctx.session.walletIndex].publicKey);
        if (ctx.session.solBalance === 0) {
            ctx.reply(`Deposit $SOLs to your wallet to place limit orders.\nWallet Address: ${ctx.session.user.wallets[ctx.session.walletIndex].publicKey}`);
        } else {
            ctx.session.messageStatus = "limit_x";
            ctx.reply(`Reply with the amount for limit order (0 - ${ctx.session.solBalance} SOL, Example: 0.1):`);
        }
    }
});

bot.action("confirm_limit_buy", async (ctx: BotContext) => {
    const amount = ctx.session?.tempLimitOrders?.amount;
    const marketCap = ctx.session?.tempLimitOrders?.marketCap;
    console.log("WalletIndex exists=================>", ctx.session?.walletIndex);
    const orderId = await generateOrderId();
    try {
        if (ctx.session?.walletIndex || ctx.session?.walletIndex === 0) {
            await saveLimitOrder(
                ctx.session?.user.userId,
                orderId,
                ctx.session.user.wallets[ctx.session.walletIndex].publicKey,
                ctx.session?.user.wallets[ctx.session.walletIndex].secretKey,
                ctx.session?.tokenToBuy.address,
                amount,
                marketCap,
                "buy"
            );
            ctx.reply(`✅ Limit Buy Order placed successfully!\nToken: ${ctx.session?.tokenToBuy.name}\nAmount: ${amount} SOL\nTarget Market Cap: $${marketCap?.toLocaleString()}`);
            delete ctx.session?.tempLimitOrders;
        }
    } catch (error) {
        console.error(error);
        ctx.reply("❌ Failed to place limit order. Please try again.");
    }
});

bot.action("swap_opt", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.selectedMode = "swap";
    const replyMarkup =
        ctx.session.walletBalances?.length === 0
            ? getSwapLimitCaption(ctx.session.selectedMode)
            : getBuyLimitSellCaption(ctx.session.selectedMode);
    await ctx.editMessageReplyMarkup({ inline_keyboard: replyMarkup });
});

bot.action("limit_opt", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.selectedMode = "limit";
    const replyMarkup =
        ctx.session.walletBalances?.length === 0
            ? getSwapLimitCaption(ctx.session.selectedMode)
            : getBuyLimitSellCaption(ctx.session.selectedMode);
    await ctx.editMessageReplyMarkup({ inline_keyboard: replyMarkup });
});

bot.action("wallets_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    let replyWallets: string = `Your wallets:\n\n`;
    ctx.session.user.wallets.forEach((item: { publicKey: any; }) => {
        replyWallets += `${item.publicKey}\n`;
    });
    replyWallets += "\nChoose a wallet"
    ctx.reply(
        replyWallets,
        Markup.inlineKeyboard([
            Markup.button.callback("Cancel", "cl_cmd")
        ])
    );
    ctx.session.messageStatus = "select_wallet";
});

bot.action("privkey_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    const privKey = ctx.session.user.wallets[ctx.session.walletIndex ?? 0].secretKey;
    ctx.reply(`${privKey}`);
});

bot.action("limit_orders", async (ctx: BotContext) => {
    let text: string = "Open orders:\n";
    const userId = ctx.session?.user.userId;
    const orders = await getLimitOrders(userId);
    const tokenPromises = orders.map(async (item) => {
        const tokenInfo = await getTokenData(item.tokenAddress);
        text +=
            `\n🟢 Buy ${tokenInfo.name}
        ├Trigger: $${item.marketCapToHit} Mcap
        ├Slippage: 10%
        ├Filled: 0.00 / 0.00 SOL
        └Order ID: ${item.orderId}`;
    });
    // Wait for all token data to be fetched
    await Promise.all(tokenPromises);
    ctx.reply(
        text,
        Markup.inlineKeyboard([
            Markup.button.callback("Remove order", "remove_order_cmd")
        ])
    );

});

bot.action("remove_order_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "remove_order";
    ctx.reply("Input Order ID you are going to remove.");
});

bot.action("cl_cmd", async (ctx: BotContext) => {
    ctx.deleteMessage();
});

// // Message Response Logics

bot.use(async (ctx: BotContext, next) => {
    if (ctx.text) {
        const userInput = ctx.text; // Get the user's input
        console.log(`User input: ${userInput}`); // Log the input or process it as needed

        if (ctx.session?.messageStatus === "buy") {
            const tokenAddress = userInput;
            const tokenData = await getTokenData(tokenAddress);
            if (tokenData) {
                ctx.session.tokenToBuy = tokenData;
                const inline_keyboard =
                    ctx.session.walletBalances?.length === 0
                        ? getSwapLimitCaption(ctx.session.selectedMode)
                        : getBuyLimitSellCaption(ctx.session.selectedMode);
                ctx.reply(
                    `${tokenData.name} | ${tokenData.symbol} | ${tokenData.address}\n\nPrice: $${tokenData.price_usd}\nMarketCap: ${tokenData.market_cap_usd}`,
                    { reply_markup: { inline_keyboard: inline_keyboard } }
                );
            } else {
                ctx.reply(`Token address ${tokenAddress} not found`);
            }
            return next();
        }
        if (ctx.session?.messageStatus === "buy_x") {
            const amount = parseFloat(userInput || "0") * 1000000000;
            if (amount && amount <= ctx.session.solBalance * 1000000000) {
                if (ctx.session.walletIndex)
                    await apiSwap(
                        ctx.session.tokenToBuy.address,
                        amount,
                        ctx.session.user.wallets[ctx.session.walletIndex].secretKey,
                        `${ctx.session.user.userId}`,
                        true
                    );
            } else {
                ctx.reply("Insufficient SOL balance for this transaction.");
            }
            return next();
        }
        if (ctx.session?.messageStatus === "sell_x") {
            const percentage = parseFloat(userInput || "0");
            if (percentage > 0 && percentage <= 100) {
                if (ctx.session.walletIndex)
                    await apiSwap(
                        ctx.session.tokenToBuy.address,
                        percentage,
                        ctx.session.user.wallets[ctx.session.walletIndex].secretKey,
                        `${ctx.session.user.userId}`,
                        false
                    );
            } else {
                ctx.reply("Please enter a valid percentage between 1 and 100.");
            }
            return next();
        }
        if (ctx.session?.messageStatus === "limit_x") {
            const amount = parseFloat(userInput || "0");
            if (amount && amount <= ctx.session.solBalance) {
                ctx.session.tempLimitOrders = { amount };
                ctx.reply(`Enter the target Market Cap (in USD) for your limit order:\nToken: ${ctx.session.tokenToBuy.name}\nAmount: ${amount} SOL\n\nExample: 1000000 (for $1M market cap)`);
                ctx.session.messageStatus = "limit_market_cap";
                return next();
            } else {
                ctx.reply("Please enter a valid amount within your balance.");
                return next();
            }
        }
        if (ctx.session?.messageStatus === "limit_market_cap") {
            const marketCap = parseFloat(userInput || "0");
            if (marketCap && marketCap > 0) {
                const amount = ctx.session.tempLimitOrders?.amount;
                ctx.session.tempLimitOrders = { amount: amount, marketCap: marketCap };
                ctx.reply(
                    `Confirm Limit Buy Order:\nToken: ${ctx.session.tokenToBuy.name}\nAmount: ${amount} SOL\nTarget Market Cap: $${marketCap.toLocaleString()}`,
                    Markup.inlineKeyboard([
                        [
                            Markup.button.callback("Confirm", "confirm_limit_buy"),
                            Markup.button.callback("Cancel", "cl_cmd")
                        ]
                    ])
                );
            } else {
                ctx.reply("Please enter a valid market cap value greater than 0.");
            }
            return next();
        }
        if (ctx.session?.messageStatus === "select_wallet") {
            const walletToUse = userInput;
            const walletIndex = ctx.session.user.wallets.findIndex((item: { publicKey: string; }) => item.publicKey === walletToUse);
            ctx.session.walletIndex = walletIndex;
            ctx.session.walletBalances = await getTokenAccounts(ctx.session.user.wallets[walletIndex].publicKey, connection);
            ctx.session.solBalance = await getSolBalance(ctx.session.user.wallets[walletIndex].publicKey);

            let text: string = `SOL Balance: ${ctx.session.solBalance} SOL\n\n`;

            if (ctx.session.walletBalances.length == 0) {
                text += "No other tokens found";
            } else {
                ctx.session.walletBalances.forEach((item) => {
                    text += `Token Name: ${item.tokenName}\nToken Address: ${item.tokenAddress}\nToken Balance: ${item.tokenBalance}\n\n`;
                });
            }
            const inline_keyboard = getStartCaption();

            ctx.reply(`${ctx.session.user.wallets[walletIndex].publicKey}\n\n${text}`, { reply_markup: inline_keyboard });
            return next();
        }
        if (ctx.session?.messageStatus === "remove_order") {
            const orderIdToRemove = userInput;
            const userId = ctx.session.user.userId;
            const result = await removeLimitOrder(userId, orderIdToRemove);
            if (result?.status === 200) {
                //Get Limit Orders again
                let text: string = "Open orders:";
                const orders = await getLimitOrders(userId);
                const tokenPromises = orders.map(async (item) => {
                    const tokenInfo = await getTokenData(item.tokenAddress);
                    text +=
                        `\n🟢 Buy ${tokenInfo.name}
                    ├Trigger: $${item.marketCapToHit} Mcap
                    ├Slippage: 10%
                    ├Filled: 0.00 / 0.00 SOL
                    └Order ID: ${item.orderId}`;
                });
                // Wait for all token data to be fetched
                await Promise.all(tokenPromises);
                ctx.reply(
                    text,
                    Markup.inlineKeyboard([
                        Markup.button.callback("Remove order", "remove_order_cmd")
                    ])
                );
            } else if (result?.status === 404) {
                // Reply with Order not found message
                ctx.reply("Order Not Found");
            } else {
                // Reply with Internal sever error. Try again later message
                ctx.reply("Internal Server Error. Please try again later.");
            }
            return next();
        }
        // You can send a response back to the user
        // ctx.reply(`You said: ${userInput}`);
    }
    return next(); // Call the next middleware or handler
});


const fetchUser = async (userId: Number | undefined, username: String | undefined) => {
    const response = await axios.post(`${BACKEND_URL}api/users`, {
        userId: userId,
        username: username,
    });
    // console.log(response.data);
    return response.data;
};

const saveLimitOrder = async (
    userId: number,
    orderId: string,
    pubKey: string,
    privKey: string,
    tokenAddress: string,
    limitAmount: number | undefined,
    marketCapToHit: number | undefined,
    mode: "buy" | "sell"
) => {
    try {
        // console.log("marketCap==============>", marketCapToHit);
        const response = await axios.post(`${BACKEND_URL}api/addOrder`, {
            userId: userId,
            orderId: orderId,
            pubKey: pubKey,
            privKey: privKey,
            tokenAddress: tokenAddress,
            limitAmount: limitAmount,
            marketCapToHit: marketCapToHit,
            mode: mode
        });
        return response.data;
    } catch (error) {
        console.error("Error in saveLimitOrder function");
    }
};

const getLimitOrders = async (userId: number): Promise<any[]> => {
    try {
        const response = await axios.post(`${BACKEND_URL}api/getOrders`,
            { userId: userId }
        );
        console.log("getLimitOrders==============>", response.data);
        return response.data;
    } catch (error) {
        console.error("Error in getLimitOrder function");
        return [];
    }
}

const removeLimitOrder = async (userId: number, orderId: string) => {
    try {
        const response = await axios.post(`${BACKEND_URL}api/removeOrder`,
            { userId: userId, orderId: orderId }
        );
        return response;
        // if (response.status === 200) {
        //     return "Removed";
        // } else if (response.status === 404) {
        //     return "Not found";
        // } else {
        //     return "Internal server error";
        // }
    } catch (error) {
        console.error(error);
        return;
    }
}

// // Define Inline Keyboards

const getStartCaption = () => {
    return {
        inline_keyboard: [
            [Markup.button.callback("Buy", "buy_cmd"), Markup.button.callback("Sell & Manage", "sell_cmd")],
            [Markup.button.callback("Choose wallet", "wallets_cmd"), Markup.button.callback("Export Private Key", "privkey_cmd")],
            [Markup.button.callback("Copy Trade", "copy_trade_cmd"), Markup.button.callback("Sniper", "sniper_cmd")],
            [Markup.button.callback("Limit Orders", "limit_orders")],
            [Markup.button.callback("Help", "help_cmd"), Markup.button.callback("Settings", "settings_cmd")],
            [Markup.button.callback("Pin", "pin_cmd"), Markup.button.callback("Refresh", "refresh_cmd")],
        ]
    };
};

const getSwapLimitCaption = (mode?: "swap" | "limit") => {
    return [
        [Markup.button.callback("Cancel", "cl_cmd")],
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
                    Markup.button.callback("◀️ Prev", "prev_opt"),
                    Markup.button.callback("Token To Buy", "no_cmd"),
                    Markup.button.callback("Next ▶️", "next_opt"),
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
                    Markup.button.callback("◀️ Prev", "prev_opt"),
                    Markup.button.callback("Token To Buy", "no_cmd"),
                    Markup.button.callback("Next ▶️", "next_opt"),
                ],
                [
                    Markup.button.callback("Limit Sell 25%", "limit_sell_25"),
                    Markup.button.callback("Limit Sell X %", "limit_sell_x"),
                ],
            ]),
        [Markup.button.callback("Refresh", "refresh_cmd")],
    ];
};

function generateOrderId() {
    const now = new Date();

    // Get the components of the date
    const year = String(now.getUTCFullYear()).slice(-2); // Last two digits of the year
    const month = String(now.getUTCMonth() + 1).padStart(2, '0'); // Month (0-11)
    const day = String(now.getUTCDate()).padStart(2, '0'); // Day of the month
    const hours = String(now.getUTCHours()).padStart(2, '0'); // Hours (0-23)
    const minutes = String(now.getUTCMinutes()).padStart(2, '0'); // Minutes
    const seconds = String(now.getUTCSeconds()).padStart(2, '0'); // Seconds

    // Construct the order ID
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Start the bot
bot.launch()
    .then(() => {
        console.log("Bot is running...");
    })
    .catch((error) => {
        console.error("Error starting bot:", error);
    });