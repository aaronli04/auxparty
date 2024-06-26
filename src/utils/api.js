import $ from 'jquery'
import humps from 'humps'
import Timer from './timer'
import { stringify } from './json'
import constants from './constants'
import corePaths from './core-api/corePaths'
import spotifyPaths from './spotify/spotifyPaths'

export class ApiClient {

    static methods = {
        GET: 'GET',
        POST: 'POST',
        PUT: 'PUT',
        PATCH: 'PATCH',
        DELETE: 'DELETE',
    }

    static successStatuses = new Set([200, 201, 204])

    constructor( path = '/', convertToSnakeCase = true ) {
        this.path = path
        this.convertToSnakeCase = convertToSnakeCase
    }

    get = async ( ...args ) => await this.urlEncodedRequest( ApiClient.methods.GET, ...args )

    post = async ( ...args ) => await this.jsonRequest( ApiClient.methods.POST, ...args )

    put = async ( ...args ) => await this.jsonRequest( ApiClient.methods.PUT, ...args )

    patch = async ( ...args ) => await this.jsonRequest( ApiClient.methods.PATCH, ...args )

    del = async ( ...args ) => await this.jsonRequest( ApiClient.methods.DELETE, ...args )

    decamelizeKeys = params => (
        this.convertToSnakeCase ? humps.decamelizeKeys( params || {} ) : params || {}
    )

    camelizeKeys = data => (
        this.convertToSnakeCase ? humps.camelizeKeys( data || {} ) : data || {}
    )

    urlEncodedRequest = async ( method, path, params, minRespTime ) => await this.makeRequest(
        `${ path }?${ $.param( params || {} ) }`,
        {
            method,
        },
        minRespTime,
    )

    jsonRequest = async ( method, path, params, minRespTime ) => await this.makeRequest(
        path,
        {
            method,
            body: stringify( params || {} ),
            headers: {
                'Content-Type': 'application/json',
            },
        },
        minRespTime,
    )

    makeRequest = async ( path, options, minRespTime ) => {
        const timer = minRespTime ? new Timer( minRespTime ) : null
        timer && timer.start()

        let resp
        try {
            resp = await fetch( this.path + path, options )
        } catch (err) {
            console.error(err)
        }

        return await this.handleResponse( resp, timer )
    }

    handleResponse = async ( resp, timer ) => {
        if (!resp) return {
            data: null,
            ok: false,
            status: null,
            headers: null,
            timer,
        }
        const { headers, status } = resp
        const ok = ApiClient.successStatuses.has(status)
        const data = this.camelizeKeys(await resp.json())
        return { data, ok, status, headers, timer }
    }
}

class CoreApiClient extends ApiClient {

    constructor() {
        super(constants.CORE_API_ORIGIN)
    }

    createUserAccount = async (params) => await this.post(corePaths.SPOTIFY_LOGIN, params)
    getUserInfo = async (params) => await this.post(corePaths.GET_USER, params)
    updateAccessToken = async (params) => await this.post(corePaths.UPDATE_ACCESS_TOKEN, params)

    getRoomByName = async (params) => await this.post(corePaths.GET_ROOM_BY_NAME, params)
    getRoomByAuxpartyId = async (params) => await this.post(corePaths.GET_ROOM_BY_AUXPARTYID, params)
    createRoom = async (params) => await this.post(corePaths.CREATE_ROOM, params)
    getAllRooms = async () => await this.get(corePaths.GET_ALL_ROOMS)
    updateRoomActive = async (params) => await this.post(corePaths.UPDATE_ROOM_ACTIVE, params)

    addVoteToSong = async (params) => await this.post(corePaths.ADD_VOTE, params)
    getVotesBySong = async (params) => await this.post(corePaths.GET_VOTE, params)
    getUserVoteBySong = async (params) => await this.post(corePaths.GET_USER_VOTE, params)

    getSongByAuxpartyId = async (params) => await this.post(corePaths.GET_SONG, params)
}

class SpotifyApiClient extends ApiClient {
    constructor() {
        super(constants.SPOTIFY_API_ORIGIN)
    }

    urlEncodedRequest = async ( method, path, accessToken, params, minRespTime ) => await this.makeRequest(
        `${ path }?${ $.param( params || {} ) }`,
        {
            method,
            headers: {
                'Authorization': `Bearer  ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        },
        minRespTime,
    )

    jsonRequest = async ( method, path, accessToken, params, minRespTime ) => await this.makeRequest(
        path,
        {
            method,
            body: stringify( params || {} ),
            headers: {
                'Authorization': `Bearer  ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
        minRespTime,
    )

    searchTrack = async (accessToken, params) => await this.urlEncodedRequest(ApiClient.methods.GET, spotifyPaths.SEARCH, accessToken, params)
    createPlaylist = async (accessToken, userId, params) => await this.post(`/v1/users/${userId}/playlists`, accessToken, params)
    addSongToPlaylist = async (accessToken, playlistId, params) => await this.post(`/v1/playlists/${playlistId}/tracks`, accessToken, params)
    playPlaylist = async (accessToken, deviceId, params) => await this.put(`${spotifyPaths.START_PLAYBACK}?device_id=${deviceId}`, accessToken, params)
    getCurrentlyPlaying = async (accessToken) => await this.get(spotifyPaths.GET_CURRENTLY_PLAYING, accessToken)
}

const api = {
    core: new CoreApiClient(),
    spotify: new SpotifyApiClient()
}

export default api