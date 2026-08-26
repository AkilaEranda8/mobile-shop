import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess, requireModuleAccess } from '../../middleware/module-access.middleware'
import { validate } from '../../middleware/validate.middleware'
import { hrController } from './hr.controller'
import { requireHrFeature } from './hr.middleware'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createDesignationSchema,
  updateDesignationSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  linkUserSchema,
} from './hr.schema'

const router = Router()

router.use(authenticate)
router.use(requireHrFeature)
router.use(enforceModuleAccess('HR'))

router.get('/overview', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'), hrController.overview)

router.get('/departments', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'), hrController.listDepartments)
router.post('/departments', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('HR', 'edit'), validate(createDepartmentSchema), hrController.createDepartment)
router.patch('/departments/:id', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('HR', 'edit'), validate(updateDepartmentSchema), hrController.updateDepartment)

router.get('/designations', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'), hrController.listDesignations)
router.post('/designations', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('HR', 'edit'), validate(createDesignationSchema), hrController.createDesignation)
router.patch('/designations/:id', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('HR', 'edit'), validate(updateDesignationSchema), hrController.updateDesignation)

router.get('/employees', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'), hrController.listEmployees)
router.post('/employees', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('HR', 'edit'), validate(createEmployeeSchema), hrController.createEmployee)
router.get('/employees/:id', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'), hrController.getEmployee)
router.patch('/employees/:id', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('HR', 'edit'), validate(updateEmployeeSchema), hrController.updateEmployee)
router.post('/employees/:id/link-user', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('HR', 'edit'), validate(linkUserSchema), hrController.linkUser)

export default router
