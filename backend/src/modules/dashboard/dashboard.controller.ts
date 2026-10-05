import { Request, Response } from "express";
import { obtenerIndicadores, obtenerPanelConserjeria } from "./dashboard.service";

export async function indicadoresController(req: Request, res: Response) {
  res.json(await obtenerIndicadores(req.auth!.condominioId));
}

export async function panelConserjeriaController(req: Request, res: Response) {
  res.json(await obtenerPanelConserjeria(req.auth!.condominioId));
}
