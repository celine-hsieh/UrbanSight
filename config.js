const {
    FORGE_CLIENT_ID="8Z2adlMwvxgp5Cl6f2dTHFqoGjVXUg7o",
    FORGE_CLIENT_SECRET="7A41NiTzgwwyCUaL",
    FORGE_BUCKET="8z2adlmwvxgp5cl6f2dthfqogjvxug7o-1127",
    PORT//="https://forgetest.herokuapp.com/"
} = process.env;

if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET || !FORGE_BUCKET) {
    console.warn('Some of the required env. variables are missing.');
    process.exit(1);
}

module.exports = {
    FORGE_CLIENT_ID,
    FORGE_CLIENT_SECRET,
    FORGE_BUCKET,
    PORT: PORT || 3000
};
