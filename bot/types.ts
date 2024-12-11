import { Context } from 'telegraf';

export interface BotContext extends Context {
    session?: {
        messageStatus?: string;
        tokenToBuy?: TokenData;
        user?: any;
        walletBalances?: any[];
        solBalance?: any;
        tokenIndex?: any;
        selectedMode?: 'swap' | 'limit';
        tempLimitOrders?: {
            amount: number;
            marketCap?: number;
        };
    };
}

export interface TokenData {
    name: string;
    symbol: string;
    address: string;
    price_usd: number;
    market_cap_usd: number;
}