import dotenv from 'dotenv';
dotenv.config();


import express from 'express';
const app = express();

app.use(express.static('public'));
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

for (let i = 34; i <= 42; i++) {
    const res = await fetch(`http://localhost:3000/jornadas/${i}.json`).then((res) => res.json());

    for (const partido of res.events) {
        const jornada = partido.roundInfo.round
        const local = partido.homeTeam.name;
        const visitante = partido.awayTeam.name;
        console.log(`Jornada ${jornada}: ${local} vs ${visitante}`);
    }
}

const standings = await fetch(
    `http://localhost:3000/standings/2026-04-04-16-55.json`,
).then((res) => res.json());

for (const equipo of standings.standings[0].rows) {
    const posicion = equipo.position;
    const nombre = equipo.team.name;
    const puntos = equipo.points;
    console.log(`${posicion}. ${nombre} - ${puntos} puntos`);
}