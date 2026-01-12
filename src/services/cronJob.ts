import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

export const initCronJobs = () => {
    // Run every hour: 0 * * * *
    cron.schedule('0 * * * *', () => {
        console.log('Running Cron Job: file-cleanup');
        deleteOldFiles();
    });
};

const deleteOldFiles = () => {
    const uploadDir = path.join(__dirname, '../../uploads');
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error('Cron Job Error: Unable to scan directory:', err);
            return;
        }

        const now = Date.now();

        files.forEach((file) => {
            const filePath = path.join(uploadDir, file);

            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error('Cron Job Error: Unable to stat file:', filePath);
                    return;
                }

                if (now - stats.mtime.getTime() > MAX_AGE) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error('Cron Job Error: Unable to delete file:', filePath);
                        } else {
                            console.log(`[Auto-Cleanup] Deleted old file: ${file}`);
                        }
                    });
                }
            });
        });
    });
};
