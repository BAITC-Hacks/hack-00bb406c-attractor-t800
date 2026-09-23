from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.application import work_results as service
from app.models import DemoSession


def router(get_db, current_session):
    routes = APIRouter(prefix='/api/work-results')

    @routes.get('')
    def listing(db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        return service.listing(db, actor)

    @routes.post('')
    def create(payload: service.Create, db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        return service.create(db, actor, payload)

    @routes.get('/{result_id}')
    def read(result_id: str, db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        return service.data(db, service.accessible(db, actor, result_id))

    @routes.post('/{result_id}/edit')
    def edit(result_id: str, payload: service.Draft, db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        return service.change(db, actor, result_id, 'edit', payload)

    @routes.post('/{result_id}/submit')
    def submit(result_id: str, db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        return service.change(db, actor, result_id, 'submit')

    @routes.post('/{result_id}/return')
    def return_result(result_id: str, payload: service.ReturnReason, db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        return service.change(db, actor, result_id, 'return', payload)

    @routes.post('/{result_id}/confirm')
    def confirm(result_id: str, db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        return service.change(db, actor, result_id, 'confirm')

    return routes
