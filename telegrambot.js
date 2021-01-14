const { Telegraf } = require('telegraf');

const TELEGRAM_GROUP_CHAT_ID = '-1001235160885';

//create a bot
const bot = new Telegraf(process.env.TELEGRAM_TOKEN) ;

bot.start(ctx => {
    ctx.reply('Welcome to Your Life Your Choice Bot');
})

const sendRemindersViaTelegram = (reminderType) => {
    bot.telegram.sendPhoto(TELEGRAM_GROUP_CHAT_ID, reminderType.image, {
        caption:
         `
            <b>${reminderType.title}</b><pre><code>${reminderType.message}</code></pre>
        `,
        parse_mode: 'HTML'
    })
}

//------------------------Telegram Bot-------------------------------------------------------------------
bot.launch();

module.exports = {bot, sendRemindersViaTelegram};