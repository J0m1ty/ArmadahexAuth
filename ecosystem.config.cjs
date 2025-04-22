module.exports = {
    apps: [
        {
            name: 'auth',
            script: 'npm',
            args: 'start',
            autorestart: true,
            env_production: {
                NODE_ENV: 'production'
            }
        },
    ],
};
