import React, { useEffect, useCallback, useState } from "react"
import { cn, getPCN } from "@/utils/classes"
import Link from "next/link"
import SongCard from "../shared/SongCard"
import { io } from "socket.io-client"
import SpotifySearch from "../shared/SpotifySearch"
import constants from "@/utils/constants"
import { getUserId } from "@/utils/userId"
import { parse } from "@/utils/json"
import useSpotifyPlaylists from "@/hooks/useSpotifyPlaylists"
import useSpotifyTracks from "@/hooks/useSpotifyTracks"
import useCompleteSongs from "@/hooks/useCompleteSongs"
import useRoom from "@/hooks/useRoom"
import { findFirstOccurrenceUri } from "@/utils/songArray"

const className = 'loaded-room-component'
const pcn = getPCN(className)

export default function LoadedRoomComponent({ ownerInfo, roomInfo }) {
    const { playPlaylist, shufflePlaylist } = useSpotifyPlaylists()
    const { getCurrentlyPlaying } = useSpotifyTracks()
    const { updateRoomActive } = useRoom()
    const { fetchCompleteSongs } = useCompleteSongs()

    const [panelOpen, setPanelOpen] = useState(false)
    const [owner, setOwner] = useState(ownerInfo)
    const [room, setRoom] = useState(roomInfo)
    const [deletePanel, setDeletePanel] = useState(false)
    const [songs, setSongs] = useState([])
    const [active, setActive] = useState(roomInfo.active)
    const [currentlyPlaying, setCurrentlyPlaying] = useState(roomInfo.currentlyPlaying)

    const socket = io(constants.CORE_API_ORIGIN)
    const userId = getUserId()
    const existingQueue = parse(room.queue)

    // Fetch song data and web sockets
    useEffect(() => {
        async function fetchSongData() {
            if (!existingQueue || existingQueue.length === 0) {
                return
            }
            const songs = await fetchCompleteSongs(existingQueue)
            setSongs(songs)
        }
        fetchSongData()

        if (!userId || !room.auxpartyId) {
            return
        }

        socket.emit('joinRoom', userId, room.auxpartyId)

        const accessTokenUpdatedListener = (updatedToken) => {
            setOwner((prevInfo) => ({
                ...prevInfo,
                accessToken: updatedToken,
            }))
        }

        const roomDeletedListener = () => {
            window.location.href = '/rooms'
        }

        const songAddedListener = (songs) => {
            setSongs(songs)
        }

        const voteAddedListener = (updatedQueue) => {
            setSongs(updatedQueue)
        }

        const currentlyPlayingSetListener = (currentlyPlaying) => {
            setCurrentlyPlaying(currentlyPlaying)
        }

        socket.on('accessTokenUpdated', accessTokenUpdatedListener)
        socket.on('roomDeleted', roomDeletedListener)
        socket.on('songAdded', songAddedListener)
        socket.on('voteAdded', voteAddedListener)
        socket.on('currentlyPlayingSet', currentlyPlayingSetListener)

        return () => {
            socket.off('accessTokenUpdated', accessTokenUpdatedListener)
            socket.off('roomDeleted', roomDeletedListener)
            socket.off('songAdded', songAddedListener)
            socket.off('voteAdded', voteAddedListener)
            socket.off('pong')
            socket.disconnect()
        }
    }, [])

    // Play the playlist
    useEffect(() => {
        async function playAndUpdate() {
            if (owner.auxpartyId !== userId) { return }
            if (songs.length > 0 && !active) {
                const shuffleResponse = await shufflePlaylist(owner.accessToken, owner.refreshToken, owner.deviceId, false)
                const newAccessToken = shuffleResponse.newAccessToken
                if (newAccessToken) {
                    socket.emit('updateAccessToken', owner.auxpartyId, newAccessToken)
                }
                const playResponse = await playPlaylist(owner.accessToken, owner.refreshToken, owner.deviceId, room.uri)
                updateRoomActive(room.auxpartyId, true)
                setActive(true)
            }
        }

        playAndUpdate()
    }, [songs, active])

    // Get current song every 10s
    useEffect(() => {
        const getPlayingInterval = setInterval(async () => {
            if (owner.auxpartyId !== userId) { return }
            if (!active) { return }
            const playingData = await getCurrentlyPlaying(owner.accessToken, owner.refreshToken)
            const newAccessToken = playingData.newAccessToken
            if (newAccessToken) {
                socket.emit('updateAccessToken', owner.auxpartyId, newAccessToken)
            }
            const currentlyPlayingUri = playingData.uri
            const firstOccurrence = findFirstOccurrenceUri(songs, currentlyPlayingUri)
            if (firstOccurrence === -1) {
                return
            }
            if (firstOccurrence !== currentlyPlaying) {
                socket.emit('setCurrentlyPlaying', room.auxpartyId, firstOccurrence)
            }
        }, 10000)

        return () => {
            clearInterval(getPlayingInterval)
        }
    }, [active])

    const deleteRoom = useCallback(() => {
        socket.emit('deleteRoom', room.auxpartyId)
    })

    const renderPanel = useCallback(() => (
        <div className={panelOpen ? pcn('__panel') : cn(pcn('__panel'), 'hidden')}>
            <div className={pcn('__title')}>
                search songs
            </div>
            <SpotifySearch ownerInfo={owner} roomInfo={room} socket={socket} />
            <button className={pcn('__close-button')} onClick={() => setPanelOpen(false)}>
                return to queue
            </button>
        </div>
    ), [panelOpen, owner])

    const renderContentBodyComp = useCallback(() => (
        <>
            <div className={deletePanel ? pcn('__delete-panel') : cn(pcn('__delete-panel'), 'hidden')}>
                <div className={pcn('__title')}>
                    delete room
                </div>
                <div className={pcn('__warning-message')}>
                    are you sure you want to delete this room? this action can&apos;t be undone
                </div>
                <div className={pcn('__button-section')}>
                    <button className={pcn('__cancel-button')} onClick={() => setDeletePanel(false)}>
                        cancel
                    </button>
                    <button className={pcn('__delete-button')} onClick={deleteRoom}>
                        delete room
                    </button>
                </div>
            </div>
            <div className={panelOpen || deletePanel ? cn(pcn('__content-body'), 'hidden') : pcn('__content-body')}>
                <div className={pcn('__name')}>
                    {room.name}
                </div>
                <Link href={owner.spotifyExternalLink} className={pcn('__link')}>
                    {owner.spotifyDisplayName}
                </Link>
                <div className={pcn('__body-section')}>
                    <div className={pcn('__now-playing')}>
                        <div className={pcn('__subtitle')}>
                            now playing
                        </div>
                        {songs[0] && <SongCard song={songs[0]} socket={socket} roomInfo={room} />}
                    </div>
                    <div className={pcn('__queue-section')}>
                        <div className={pcn('__subtitle')}>
                            queue
                        </div>
                        <div className={pcn('__queue')}>
                            {songs.slice(1).map((song, index) =>
                                <SongCard key={index} song={song} socket={socket} roomInfo={room} />
                            )}
                        </div>
                    </div>
                </div>
                <div className={pcn('__button-section')}>
                    <button className={pcn('__add-song')} onClick={() => setPanelOpen(true)}>
                        add song
                    </button>
                    <button className={userId === owner.auxpartyId ? pcn('__delete-room') : cn(pcn('__delete-room'), 'hidden')} onClick={() => setDeletePanel(true)}>
                        delete room
                    </button>
                </div>
            </div>
        </>
    ), [songs, panelOpen, deletePanel])

    return (
        <div className={className}>
            <div className={pcn('__liner')}>
                {renderPanel()}
                {renderContentBodyComp()}
            </div>
        </div>
    )
}