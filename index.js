
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// Ensure ffmpeg is installed and accessible
// If not, you might need to install it: sudo apt update && sudo apt install ffmpeg

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async (msg) => {
    const chat = await msg.getChat();
    if (msg.body === '!ping') {
        msg.reply('pong');
    } else if (msg.body.startsWith('!stream')) {
        // Expected format: !stream <RTMPS_URL> <STREAM_KEY> <VIDEO_PATH_OR_URL> [REPEAT_COUNT]
        const args = msg.body.split(' ');
        if (args.length < 4) {
            msg.reply('Usage: !stream <RTMPS_URL> <STREAM_KEY> <VIDEO_PATH_OR_URL> [REPEAT_COUNT]');
            return;
        }

        const rtmpsUrl = args[1];
        const streamKey = args[2];
        const videoSource = args[3]; // This could be a local path or a URL
        const repeatCount = parseInt(args[4] || '1');

        msg.reply(`Starting stream to ${rtmpsUrl} with video ${videoSource}. Repeat count: ${repeatCount}`);

        // For simplicity, we'll assume videoSource is a local file path for now.
        // In a real scenario, you'd need to download the video if it's a URL.
        const videoPath = videoSource; // Placeholder

        if (!fs.existsSync(videoPath)) {
            msg.reply(`Error: Video file not found at ${videoPath}`);
            return;
        }

        for (let i = 0; i < repeatCount; i++) {
            try {
                await new Promise((resolve, reject) => {
                    ffmpeg(videoPath)
                        .outputOptions([
                            '-c:v libx264',
                            '-preset veryfast',
                            '-b:v 3000k',
                            '-maxrate 3000k',
                            '-bufsize 6000k',
                            '-pix_fmt yuv420p',
                            '-g 50',
                            '-c:a aac',
                            '-b:a 160k',
                            '-ar 44100',
                            '-f flv'
                        ])
                        .output(`${rtmpsUrl}/${streamKey}`)
                        .on('start', function(commandLine) {
                            console.log('Spawned FFmpeg with command: ' + commandLine);
                            chat.sendMessage(`Stream ${i + 1}/${repeatCount} started!`);
                        })
                        .on('error', function(err, stdout, stderr) {
                            console.error('FFmpeg error: ' + err.message);
                            console.error('FFmpeg stdout: ' + stdout);
                            console.error('FFmpeg stderr: ' + stderr);
                            chat.sendMessage(`Stream ${i + 1}/${repeatCount} failed: ${err.message}`);
                            reject(err);
                        })
                        .on('end', function() {
                            console.log('FFmpeg process finished successfully');
                            chat.sendMessage(`Stream ${i + 1}/${repeatCount} finished!`);
                            resolve();
                        })
                        .run();
                });
            } catch (error) {
                console.error('Streaming error:', error);
                msg.reply(`An error occurred during streaming: ${error.message}`);
                break; // Stop repeating if an error occurs
            }
        }
        msg.reply('All streaming tasks completed or stopped due to error.');

    } else if (msg.body === '!stop') {
        // Implement logic to stop ongoing streams if any
        msg.reply('Stopping any active streams (not yet implemented).');
    }
});

client.initialize();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Shutting down client...');
    await client.destroy();
    process.exit(0);
});



