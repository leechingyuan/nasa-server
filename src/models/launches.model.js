const axios = require('axios');

const launchesDatabase = require('./launches.mongo');
const planets = require('./planets.mongo');

const launches = new Map();

const DEFAULT_FLIGHT_NUMBER = 100;

const SPACEX_API_URL = 'https://api.spacexdata.com/v4/launches/query';

async function populateLaunches() {
    console.log('Downloading launch data');
    const response = await axios.post(SPACEX_API_URL, {
        query: {},
        options: {
            pagination: false,
            populate: [
                {
                    path: 'rocket',
                    select: {
                        name: 1
                    }
                },
                {
                    path: 'payloads',
                    select: {
                        customers: 1
                    }
                }
            ]
        }
    });

    if (response.status !== 200) {
        console.log('Problem downloading launch data');
        throw new Error('Launch data download failed!');
    }

    const launchDocs = response.data.docs;
    for (const launchDoc of launchDocs) {

        const payloads = launchDoc['payloads'];
        const customers = payloads.flatMap((payload) => {
            return payload['customers'];
        });

        const launch = {
            flightNumber: launchDoc['flight_number'],
            mission: launchDoc['name'],
            rocket: launchDoc['rocket']['name'],
            launchDate: launchDoc['date_local'],
            //target: 'Kepler-442 b', // not applicable
            upcoming: launchDoc['upcoming'],
            success: launchDoc['success'],

            customers: customers, // payloads -> customers
        };

        console.log(launch);
        await saveLaunch(launch);
    }
}

async function loadLaunchData() {
    const firstLaunch = await findLaunch({
        flightNumber: 1,
        rocket: 'Falcon 1',
        mission: 'FalconSat',
    });

    if (firstLaunch) {
        console.log('Launch data already loaded');
    } else {
        await populateLaunches();
    }
}

async function findLaunch(filter) {
    return await launchesDatabase.findOne(filter);
}

async function existsLaunchWithId(launchId) {
    return await findLaunch({
        flightNumber: launchId
    });
    //return launches.has(launchId);
}

async function getLatestFlightNumber() {
    const latestLaunch = await launchesDatabase
        .findOne()
        .sort('-flightNumber'); // minus means descending 

    if (!latestLaunch) {
        return DEFAULT_FLIGHT_NUMBER;
    }

    return latestLaunch.flightNumber;
}

async function getAllLaunches(skip, limit) {
    //return Array.from(launches.values());
    return await launchesDatabase
        .find({}, {'_id': false, '__v': false})
        .sort({flightNumber: 1})
        .skip(skip)
        .limit(limit);
}

async function saveLaunch(launch) {
    try {
        await launchesDatabase.findOneAndUpdate({  //updateOne({
            flightNumber: launch.flightNumber,
        }, launch, {
            upsert: true,
        });
    } catch(err) {
        console.log(`Could not save ${launch}: ${err}`);
    }
}

async function scheduleNewLaunch(launch) {
    if (! await planets.findOne({keplerName: launch.target}) ) {
        throw new Error(`Planet ${launch.target} does not exists!`);
    }

    const newLaunch = Object.assign(launch, {
        flightNumber: await getLatestFlightNumber() + 1,
        customers: ['ZTM', 'NASA'],
        upcoming: true,
        success: true
    });

    await saveLaunch(newLaunch);
    return newLaunch;
}

async function abortLaunchById(launchId) {
    const aborted = await launchesDatabase.updateOne({
        flightNumber: launchId,
    }, {
        upcoming: false,
        success: false,
    });

    return aborted.acknowledged && aborted.modifiedCount === 1;
}

module.exports = {
    loadLaunchData,
    existsLaunchWithId,
    getAllLaunches,
    scheduleNewLaunch,
    abortLaunchById,
}

