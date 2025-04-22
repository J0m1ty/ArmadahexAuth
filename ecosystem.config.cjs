module.exports = {
    apps: [
        {
            name: 'auth',
            version: '1.0.0',
            script: 'npm',
            args: 'start',
            autorestart: true,
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],
};
