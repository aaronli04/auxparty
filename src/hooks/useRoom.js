import { stringify } from "@/utils/json"
import { localStorageGet } from "@/utils/localStorage"

function useRoom() {
    async function getRoom(auxpartyId) {
        try {
            if (!auxpartyId) { return }

            const body = stringify({ auxpartyId: auxpartyId })

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND}/room/get`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: body
            })

            const result = await response.json()
            const data = result.data
            return data
        } catch (err) {
            console.log(err)
        }
    }

    async function createRoom(roomName, roomPassword) {
        const userId = localStorageGet('user-id')
        const data = {
            auxpartyId: userId,
            roomName,
            roomPassword,
            active: true
        }
        const body = stringify(data)
        try {
            if (!userId || !roomName || !roomPassword) { return }
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND}/room/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body
            })
            const result = await response.json()
            console.log(result)
        } catch (err) {
            console.log(err)
        }
    }

    return {
        getRoom: getRoom,
        createRoom: createRoom
    }
}

export default useRoom;