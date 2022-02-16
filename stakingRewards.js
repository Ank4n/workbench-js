// Required imports
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { types2700: types } = require('@kiltprotocol/type-definitions');
require('dotenv').config();

// Initialise the provider to connect to the local node
const address = process.env.WS_ADDRESS || 'wss://spiritnet.kilt.io';
const provider = new WsProvider(address);
const REWARD_TARGET = process.env.KILT_ADDRESS || '4tDe3xTK2opiuzSBtok6c9nvuNcugp4Qat4E1dK7gPanZWVg';
const START_BLOCK = process.env.START_BLOCK || 132305;
const END_BLOCK = process.env.END_BLOCK || 132350;

// Check event for parachainStarking.Rewarded event
function extractRewardData(event) {
    if (event.section == 'parachainStaking' && event.method == 'Rewarded' && event.data.length == 2) {
        return { account: event.data[0].toString(), amount: formatBalance(event.data[1].toNumber()) }
    }
    return { account: '', amount: 0 }
}

// Formats balance into KILT by accounting for the denomination of 15 decimals
function formatBalance(amount) {
    return amount / Math.pow(10, 15);
}

// Traverse blocks from start to finish and check events for parachainStaking rewards to target address
async function traverseBlocks(api, start, end) {
    let rewards = [];
    let block = start;
    let total = 0;

    while (block < end) {
        const blockHash = await api.rpc.chain.getBlockHash(block);
        console.log(`Checking block ${block} with hash ${blockHash}.`)

        // filter events for parachainStarking.Rewarded and append to reward data
        const events = await api.query.system.events.at(blockHash);
        rewards = events.reduce((blockRewards, { event }) => {
            const { account, amount } = extractRewardData(event);
            if (account == REWARD_TARGET) {
                console.log(`\t ${REWARD_TARGET} received ${amount} KILT.`);

                total += amount;
                console.log(`\t Total rewards since start (#${start}): ${total} KILT.`)

                return [...blockRewards, { blockNumber: block, blockHash: blockHash.toString(), amount }];
            }
            return blockRewards;
        }, rewards);

        // increment block number
        block += 1;
    }

    // log rewards as table
    console.table(rewards)

    // log total collected rewards
    console.log(`Total rewards: ${total}`);
}

// Execute script
async function main() {
    // Create our API with a default connection to the local node
    const api = await ApiPromise.create({ provider, types });

    await traverseBlocks(api, Number.parseInt(START_BLOCK, 10), Number.parseInt(END_BLOCK, 10));
}
main().catch(console.error).finally(() => process.exit());
