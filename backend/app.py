import socketio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from repositories.DataRepository import DataRepository
from models.models import Car, ErrorNotFound, Ride, DTOaction,TypeCreate,TypeResponse,NewTypeNotification,ChauffeurResponse,ChauffeurUpdate


# ----------------------------------------------------
# App setup
# ----------------------------------------------------

# Create a FastAPI app, add CORS middleware, initialize Socket.IO server + ASGI app, create async queue for messages
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
sio = socketio.AsyncServer(cors_allowed_origins='*', async_mode='asgi', logger=True)
sio_app = socketio.ASGIApp(sio, app)

ENDPOINT = "/api/v1"  # Define the endpoint for the API


# ----------------------------------------------------
# FastAPI Endpoints
# ----------------------------------------------------


@app.get("/")
async def root():
    return "Server werkt, maar hier geen API endpoint gevonden."


# region ########## DEZE ROUTES/SOCKETIOS ZIJN VOOR DE FRONTEND - GEEN WIJZIGINGEN AANBRENGEN!! ##########


@app.get(ENDPOINT + '/taxis/status/', summary="Get info from all taxis", response_model=list[Car], responses={404: {"model": ErrorNotFound}}, tags=["Given endpoint for frontend exam"])
async def get_taxis_status():
    data = DataRepository.read_taxis_status()
    if not data:
        HTTPException(status_code=404, detail="Geen taxi's gevonden")
    return data


@app.get(ENDPOINT + '/rides/{rideID}/', summary="Get info from taxi by id", responses={404: {"model": ErrorNotFound}}, tags=["Given endpoint for frontend exam"])
async def get_ride_by_id(rideID: int):
    data = DataRepository.read_ride_by_id(rideID)
    if not data:
        raise HTTPException(status_code=404, detail="Taxi niet gevonden")
    return data


@app.patch(ENDPOINT + '/rides/{rideID}/', summary="Stop a ride",  responses={404: {"model": ErrorNotFound}}, tags=["Given endpoint for frontend exam"])
async def patch_ride_by_id(rideID: int, action: DTOaction):
    print(f"Received action: {action.action} for ride ID: {rideID}")
    if action.action == "stop":
        patchdata = DataRepository.update_end_ride(rideID)
        if not patchdata:
            raise HTTPException(status_code=404, detail="Rit niet gevonden")
        else:
            ridedata = DataRepository.read_ride_by_id(rideID)
            await sio.emit('B2F_ride_stopped', {"rit": rideID, "status": "stop", "carID": ridedata["autoID"]})
            return ridedata
    else:
        raise HTTPException(status_code=400, detail="action not recognized")


@app.post(ENDPOINT + '/rides/{carID}/', summary="Start a ride", responses={404: {"model": ErrorNotFound}, 400: {"model": ErrorNotFound}}, tags=["Given endpoint for frontend exam"])
async def post_ride_by_id(carID: int, action: DTOaction):
    if action.action == "start":
        # check if taxi is available
        data = DataRepository.read_taxis_by_id(carID)

        if (data['status'] == "bezet"):
            raise HTTPException(status_code=400, detail="Taxi already busy")
        else:
            # if taxi is available, start ride
            new_id = DataRepository.insert_start_ride(carID)
            print(f"New ride started with ID: {new_id}")
            if (new_id > 0):
                data = DataRepository.read_ride_by_id(new_id)
                await sio.emit('B2F_new_ride', {"carID": carID, "ridid": new_id})
                return data
    else:
        HTTPException(status_code=404, detail="action not recognized")

# ----------------------------------------------------
# Socket.IO Handlers
# ----------------------------------------------------


@app.route('/')
def hallo():
    return "Server is running. Gebruik de juiste endpoints om de data op te halen."



# ----------------------------------------------------
# Run the app
# ----------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:sio_app", host="0.0.0.0", port=8000, reload=True, reload_dirs=["backend"])
