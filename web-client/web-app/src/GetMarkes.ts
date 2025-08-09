export const getMarkers = async () => {
    return [
        {
            id: 1,
            url: "http: //example",
            coordinates: [37.6178, 55.7512],
            adress: "Остановка",
            count: 5,
            velocity: 5,
            load: 10,
        },
        {
            id: 2,
            coordinates: [30.3358, 59.9342],
            url: "http: //example",
            adress: "Государственный Эрмитаж",
            count: 5,
            velocity: 5,
            load: 5,
        },
        {
            id: 3,
            url: "http: //example",
            coordinates: [43.5855, 39.7231],
            title: "Олимпийский парк Сочи",
            count: 5,
            velocity: 5,
            load: 1,
        }
    ];
}