import { app } from "./app";
import { env } from "./config/env";
import { programarRecordatorios } from "./modules/recordatorios/recordatorios.programador";

app.listen(env.port, () => {
  console.log(`HabitaSmart API escuchando en http://localhost:${env.port}`);
  programarRecordatorios();
});
