from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.application import imports


def router(get_db, current_session):
    def operator(session=Depends(current_session)):
        if session.actor_role != 'operator':
            raise HTTPException(403, 'Доступно только оператору')
        return session

    routes = APIRouter(prefix='/api/operator/import', dependencies=[Depends(operator)])

    @routes.post('/preview')
    def preview(payload: imports.Upload, db: Session = Depends(get_db)):
        return imports.prepare(db, payload)[0]

    @routes.post('/apply')
    def apply(payload: imports.Upload, db: Session = Depends(get_db)):
        return imports.apply(db, payload)

    class Reset(BaseModel):
        confirmed: bool = False

    @routes.post('/reset')
    def reset(payload: Reset, db: Session = Depends(get_db)):
        if payload.confirmed is not True:
            raise HTTPException(409, 'Подтвердите удаление проверочных данных')
        return imports.reset(db)

    return routes
