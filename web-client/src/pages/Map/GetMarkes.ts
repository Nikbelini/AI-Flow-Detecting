import {baseUrl} from './env'

export const getMarkers = async () => {
    try {
        const response = await fetch(`${baseUrl}/stops`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const d = await response.json();
        const data = d.stops;
        data.forEach(element => {
            element.coordinates = [element.lng, element.lat]
        });
        return data;
    } catch (error) {
        console.error('Error fetching markers:', error);
        // You might want to return an empty array or handle the error differently
        return [];
    }
};