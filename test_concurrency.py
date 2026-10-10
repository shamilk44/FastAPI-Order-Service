import asyncio
import time
import httpx

BASE_URL = "http://127.0.0.1:8000"


async def main():
    async with httpx.AsyncClient(timeout=60.0) as client:
        unique_sku = f"CONC-TEST-{time.time_ns()}"

        response = await client.post(
            f"{BASE_URL}/products/",
            json={
                "name": "Concurrency Test Product",
                "sku": unique_sku,
                "description": "Concurrent order testing",
                "price": "100.00",
                "stock_quantity": 3,
            },
        )

        if response.status_code != 201:
            print("Product creation failed!")
            print("Status:", response.status_code)
            print("Response:", response.text)
            return

        product_id = response.json()["id"]
        print("Test product ID:", product_id)
        print("Sending 10 orders and 10 reports concurrently...")

        async def place_order():
            try:
                result = await client.post(
                    f"{BASE_URL}/orders/",
                    json={"product_id": product_id, "quantity": 1},
                )
                return result.status_code
            except httpx.RequestError as exc:
                print("Order request error:", exc)
                return 0

        async def get_report():
            try:
                result = await client.get(
                    f"{BASE_URL}/reports/summary"
                )
                return result.status_code
            except httpx.RequestError as exc:
                print("Report request error:", exc)
                return 0

        start = time.perf_counter()

        results = await asyncio.gather(
            *[place_order() for _ in range(10)],
            *[get_report() for _ in range(10)],
        )

        elapsed = time.perf_counter() - start
        order_results = results[:10]
        report_results = results[10:]

        successful = order_results.count(201)
        rejected = order_results.count(409)
        other_orders = 10 - successful - rejected
        successful_reports = report_results.count(200)
        failed_reports = 10 - successful_reports

        final_response = await client.get(
            f"{BASE_URL}/products/{product_id}"
        )

        print("\n--- CONCURRENCY TEST RESULTS ---")
        print("Successful orders:", successful)
        print("Rejected orders:", rejected)
        print("Other order responses:", other_orders)
        print("Successful reports:", successful_reports)
        print("Failed reports:", failed_reports)
        print(f"Concurrent request time: {elapsed:.3f}s")

        if final_response.status_code != 200:
            print("Could not retrieve final stock:", final_response.text)
            return

        final_stock = final_response.json()["stock_quantity"]
        print("Final stock:", final_stock)

        if (
            successful == 3
            and rejected == 7
            and other_orders == 0
            and successful_reports == 10
            and failed_reports == 0
            and final_stock == 0
        ):
            print("\nPASS: No stock overselling; all reports succeeded.")
        else:
            print("\nCHECK: Results differ from expectations.")


if __name__ == "__main__":
    asyncio.run(main())
