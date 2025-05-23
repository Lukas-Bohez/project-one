from .Database import Database


class DataRepository:
    # region ########## ONDERSTAANDE METHODS ZIJN VOOR DE FRONTEND - GEEN WIJZIGINGEN AANBRENGEN!! ##########
    @staticmethod
    def read_taxis_status():
        sql = "SELECT  a.autoID, a.imageID, a.aantalpersonen, r.ritID, r.startTijd, r.eindTijd, a.merk, a.model, a.kenteken, tt.*, case when r.eindTijd is not null or r.ritid is null then 'vrij' else 'bezet' end as status FROM rit r INNER JOIN (SELECT autoID, MAX(startTijd) AS maxStartTime FROM rit GROUP BY autoID) last_trip ON r.autoID = last_trip.autoID AND r.startTijd = last_trip.maxStartTime RIGHT JOIN auto a ON r.autoID = a.autoID INNER JOIN taxitype tt ON a.typeID = tt.typeID ORDER BY autoID ASC"
        return Database.get_rows(sql)

    # # ok

    @staticmethod
    def read_ride_by_id(ritid):
        sql = "SELECT r.ritid, a.autoID, a.merk, a.model, a.kenteken, t.typeName,  r.startTijd, r.eindTijd, case when eindTijd is not null then 'vrij' else 'bezet' end as status, c.chauffeurID, c.naam,c.telefoonnummer FROM auto a INNER JOIN TaxiType t ON a.typeID = t.typeID INNER  JOIN  rit r ON a.autoID = r.autoID INNER JOIN chauffeur c ON a.chauffeurID = c.chauffeurID WHERE r.ritid =%s"
        params = [ritid]
        return Database.get_one_row(sql, params)

    # # ok
    @staticmethod
    def insert_start_ride(autoID):
        sql = "INSERT INTO rit (autoID, startTijd) VALUES (%s, NOW())"
        params = [autoID]
        return Database.execute_sql(sql, params)

    # # ok
    @staticmethod
    def update_end_ride(ritid):
        sql = "UPDATE rit SET eindTijd = NOW() WHERE ritID = %s"
        params = [ritid]
        return Database.execute_sql(sql, params)

    # # ok
    @staticmethod
    def read_taxis_by_id(autoID):
        sql = "SELECT  a.autoID,r.ritID, r.startTijd, r.eindTijd, a.merk, a.model, a.kenteken, tt.*, case when r.eindTijd is not null or r.ritid is null then 'vrij' else 'bezet' end as status FROM rit r INNER JOIN (SELECT autoID, MAX(startTijd) AS maxStartTime FROM rit GROUP BY autoID) last_trip ON r.autoID = last_trip.autoID AND r.startTijd = last_trip.maxStartTime RIGHT JOIN auto a ON r.autoID = a.autoID INNER JOIN taxitype tt ON a.typeID = tt.typeID WHERE a.autoID = %s"
        params = [autoID]
        return Database.get_one_row(sql, params)

    # endregion ########## BOVENSTAANDE METHODS ZIJN VOOR DE FRONTEND - GEEN WIJZIGINGEN AANBRENGEN!! ##########

