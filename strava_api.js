const fetch = require('node-fetch');
const dotenv = require('dotenv');
const User  = require('./models/User');
const Time  = require('./models/Time');
const Route  = require('./models/Route');

dotenv.config()

const auth_link = "https://www.strava.com/oauth/token"

function authoriseUser(code) {
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
        .then(async data => {
            console.log('Adding new user...')
            const user = new User({
                    'id' : data.athlete.id,
                    'refresh_token' : data.refresh_token,
                    'name' : `${data.athlete.firstname} ${data.athlete.lastname}`,
                    'profile' : data.athlete.profile,
                    'username' : data.athlete.username,
                    'weekly_stats' : {
                        'total_distance' : 0,
                        'total_time' : 0,
                        'most_recent_recorded_id' : -1,
                    }
            })
            const route = new Route({
                'owner' : data.athlete.id,
                'polylines' : []
            })
            const findUser = await User.find({id : data.athlete.id})
            if (findUser.length != 0) return
            await user.save()
            await route.save()
            console.log('Done!')
            }
        )
}

async function reAuthorize(user) {
    fetch(auth_link, {
        method: 'post',

        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: '71610',
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            refresh_token: user.refresh_token,
            grant_type: 'refresh_token'
        })

    }).then(res => res.json())
        .then(res => getActivities(res, user))
}

function getActivities(res, user) {
    const activities_link = `https://www.strava.com/api/v3/athlete/activities?access_token=${res.access_token}`
    fetch(activities_link)
        .then((res) => res.json())
        .then(async (data) => 
        {   
            // computing the date reference for start of week
            const times = await Time.find()
            let time = new Time({
                'week' : -1
            }) 
            if (times.length == 0) {
                await time.save()
            } else {
                time = times[0]
            }

            const date = new Date()
            date.setDate(date.getDate() - date.getDay() + 1)
            const start_of_week = new Date(date.toDateString())
            // If new week, reset all statistics
            if (start_of_week != time.week) {
                user.weekly_stats = {
                    'total_distance' : 0,
                    'total_time' : 0,
                    'most_recent_recorded_id' : -1,
                }
                
                time.week = start_of_week
                await user.save()
                await time.save()
            }
            console.log(`Computing statistics for week starting ${time.week}`)
            for (let run = 0; run < data.length; run++) {
                console.log(run)
                const date_of_run = new Date(data[run].start_date_local)
                // Do not update user stats if run is in a previous week or
                // if we have reached a previously updated run
                console.log(parseInt(data[run].id), user.weekly_stats.most_recent_recorded_id)
                if (date_of_run < start_of_week || parseInt(data[run].id) ===
                    user.weekly_stats.most_recent_recorded_id) {
                    break;
                }
                console.log(run)
                if (run === 0) {
                    user.weekly_stats.most_recent_recorded_id = data[run].id
                }
                console.log(user.weekly_stats.total_distance, data[run].distance)
                console.log(user.weekly_stats.total_time, data[run].moving_time)
                user.weekly_stats.total_distance += data[run].distance / 1000
                user.weekly_stats.total_time += data[run].moving_time / 60
                const routes = await Route.find({owner: user.id})
                if (!routes[0].polylines.includes(data[run].map.summary_polyline)
                && data[run].map.summary_polyline != null) {
                    const route = routes[0]
                    route.polylines.push(data[run].map.summary_polyline)
                    await route.save()
                }
            }
            console.log(user.weekly_stats)
            await user.save()
        })
}

module.exports = {
    authoriseUser: authoriseUser,
    reAuthorize: reAuthorize,
};