from fastapi import APIRouter

from app.api.v1.endpoints import auth, assessments, classes, diagnostics, materials, submissions

router = APIRouter()
router.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
router.include_router(classes.router, prefix="/api/v1/classes", tags=["classes"])
router.include_router(assessments.router, prefix="/api/v1/assessments", tags=["assessments"])
router.include_router(assessments.questions_router, prefix="/api/v1/questions", tags=["questions"])
router.include_router(diagnostics.router, prefix="/api/v1/assessments", tags=["diagnostics"])
router.include_router(materials.router, prefix="/api/v1/materials", tags=["materials"])
router.include_router(submissions.router, prefix="/api/v1/submissions", tags=["submissions"])
