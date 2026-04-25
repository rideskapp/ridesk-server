import { Router } from "express";
import systemConfig from "../config/system-config.json";

const router = Router();

/**
 * @swagger
 * /api/system-config:
 *   get:
 *     summary: Get system configuration
 *     description: Retrieve system-wide configuration settings. This is a public endpoint that does not require authentication.
 *     tags: [System Configuration]
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         products:
 *                           type: object
 *                           properties:
 *                             equipmentDiscountAmount:
 *                               type: number
 *                               example: 10
 *                               description: "Equipment discount amount"
 *                             equipmentDiscountCurrency:
 *                               type: string
 *                               example: "EUR"
 *                               description: "Currency code for equipment discount"
 *             example:
 *               success: true
 *               message: "System configuration retrieved successfully"
 *               data:
 *                 products:
 *                   equipmentDiscountAmount: 10
 *                   equipmentDiscountCurrency: "EUR"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: systemConfig,
      message: "System configuration retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
