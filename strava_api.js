import fetch from 'node-fetch'
import dotenv from 'dotenv'
dotenv.config()

// data store
var DATA = {
    'users' : [],
    'routes' : [],
    'week' : -1,
}

export function addUser(req, res, next) {
    const code = req.url.split('&')[1].substring(5);
    authoriseUser(code);
    res.json({message: "New user added!"});
};

const auth_link = "https://www.strava.com/oauth/token"

function authoriseUser(code){
    fetch(auth_link,{
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: '71610',
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        })
    }).then(res => res.json())
        .then(data => {
            DATA.users.push(
            {
                'id' : data.athlete.id,
                'refresh_token' : data.refresh_token,
                'name' : `${data.athlete.firstname} ${data.athlete.lastname}`,
                'profile' : data.athlete.profile,
                'weekly_stats' : {
                    'total_distance' : 0,
                    'total_time' : 0,
                    'most_recent_recorded_id' : -1,
                }
            })
            console.log(DATA)
            }
        )
}


export function updateLeaderboard(req, res, next) {
    console.log('Updating leaderboard...')
    for (let user = 0; user < DATA.users.length; user++) {
        reAuthorize(user)
    }
    res.json({message: "Leaderboard updated!"});
};

function reAuthorize(user) {
    fetch(auth_link, {
        method: 'post',

        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: '71610',
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            refresh_token: DATA.users[user].refresh_token,
            grant_type: 'refresh_token'
        })

    }).then(res => res.json())
        .then(res => getActivities(res, user))
}

function getActivities(res, user) {
    const activities_link = `https://www.strava.com/api/v3/athlete/activities?access_token=${res.access_token}`
    fetch(activities_link)
        .then((res) => res.json())
        .then((data) => 
        {
            // computing the date reference for start of week
            const date = new Date()
            date.setDate(date.getDate() - date.getDay() + 1)
            const start_of_week = new Date(date.toDateString())
            // If new week, reset all statistics
            if (start_of_week != DATA.week) {
                DATA.users[user].weekly_stats = {
                    'total_distance' : 0,
                    'total_time' : 0,
                    'most_recent_recorded_id' : -1,
                }
                DATA.week = start_of_week
            }
            console.log(`Computing statistics for week starting ${DATA.week}`)
            for (let run = 0; run < data.length; run++) {
                const date_of_run = new Date(data[run].start_date_local)
                // Do not update user stats if run is in a previous week or
                // if we have reached a previously updated run
                if (date_of_run < start_of_week || data[run].id ===
                    DATA.users[user].weekly_stats.most_recent_recorded_id) {
                    break;
                }
                DATA.users[user].weekly_stats.most_recent_recorded_id = data[run].id
                DATA.users[user].weekly_stats.total_distance += data[run].distance / 1000
                DATA.users[user].weekly_stats.total_time += data[run].moving_time / 60
                DATA.routes.push(data[run].map.summary_polyline)
            }
            console.log(DATA.users[user].weekly_stats)
        })
}