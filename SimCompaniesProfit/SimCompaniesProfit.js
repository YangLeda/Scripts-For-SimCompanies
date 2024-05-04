import { unlinkSync, writeFileSync } from "fs";
import axios from "axios";
import { convertCsvToXlsx } from "@aternus/csv-to-xlsx";

const PROXY = {
    proxy: {
        protocol: "http",
        host: "127.0.0.1",
        port: 7890,
    },
};

const REALM = 0;
const TOTAL_BUILDING_LEVEL = 24;
const ADMIN_OVERHEAD = 13.53 / 100 + 1;

let nameList = null;
let productList = [];

await fetchNameList();
await fetchAllProfitLists();
printResult();

async function fetchAllProfitLists() {
    for (const [key, value] of Object.entries(nameList)) {
        if (key.length === 4 && key.startsWith("bd-")) {
            const typeId = key.slice(-1);
            const typeName = value;

            let result = null;
            while (!result) {
                console.log("开始获取 " + typeName);
                result = await fetchProfitList(typeId, typeName);
                await sleep(100);
            }
            productList = [...productList, ...result];
        }
    }
    console.log("总计商品种类：" + productList.length);
}

async function fetchProfitList(typeId, typeName) {
    let products = [];
    try {
        const response = await axios.get(`https://simcotools.app/api/v3/profitcalculator/?realm=${REALM}&building=${typeId}&quality=0`, PROXY);
        let body = response.data;

        for (const product of body) {
            let object = {};

            object.type_id = typeId;
            object.type_name = typeName;
            object.item_id = product.resource;
            object.item_name = nameList["re-" + object.item_id];

            object.item_production_amount_per_hour = product.base_production_per_hour;
            object.exchange_price_per_item = product.exchange_price;
            object.transport_cost_per_item = product.transport_price * product.transportation;
            let inputsCost = 0;
            for (const input of product.inputs) {
                inputsCost += input.amount * input.price;
            }
            object.inputs_cost_per_item = inputsCost;
            object.wages_cost_per_item = product.wages / product.base_production_per_hour;

            object.profit_per_day =
                (object.exchange_price_per_item * 0.97 - object.inputs_cost_per_item - object.wages_cost_per_item * ADMIN_OVERHEAD - object.transport_cost_per_item) *
                object.item_production_amount_per_hour *
                24 *
                TOTAL_BUILDING_LEVEL;
            object.profit_per_day = object.profit_per_day.toFixed(0);
            products.push(object);
        }
        return products;
    } catch (error) {
        return null;
    }
}

async function fetchNameList() {
    console.log("开始获取名称列表");
    const response = await axios.get(`https://simcotools.app/api/v1/langs/zh.json`, PROXY);
    nameList = response.data;
    await sleep(100);
}

function printResult() {
    let content = "";
    content += "生产建筑,商品名称,每日总盈利\n";
    for (const product of productList) {
        content += product.type_name;
        content += ",";
        content += product.item_name;
        content += ",";
        content += product.profit_per_day;
        content += "\n";
    }

    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth() + 1;
    let fileName = "Simscompanies商品日收益" + mm + dd;

    try {
        unlinkSync(fileName + ".csv");
    } catch (error) {}

    try {
        unlinkSync(fileName + ".xlsx");
    } catch (error) {}

    try {
        writeFileSync(fileName + ".csv", content, { flag: "a" });
    } catch (error) {
        console.log(error);
    }

    try {
        convertCsvToXlsx(fileName + ".csv", fileName + ".xlsx");
    } catch (error) {
        console.log(error);
    }

    try {
        unlinkSync(fileName + ".csv");
    } catch (error) {}
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
