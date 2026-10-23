from fastapi.testclient import TestClient

from apps.api import main as api_main


def test_api_exposes_contracts_and_runs_engine(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(api_main, "RUNS_DIR", tmp_path)
    client = TestClient(api_main.app)

    assert client.get("/health").json() == {"status": "ok"}
    datasets = client.get("/api/datasets").json()["datasets"]
    assert any(ds["id"] == "synthetic" for ds in datasets)

    workflows = client.get("/api/workflows").json()["workflows"]
    assert {item["workflow"] for item in workflows} == {
        "quality_assessment",
        "spatial_clustering",
        "gene_expression",
    }

    selection = client.post(
        "/api/select",
        json={"question": "Show spatial expression of GENE_0000", "selector": "rules"},
    )
    assert selection.status_code == 200
    assert selection.json()["workflow"] == "gene_expression"

    response = client.post(
        "/api/runs",
        json={
            "question": "Show spatial expression of GENE_0000",
            "dataset_id": "synthetic",
            "selector": "rules",
            "parameters": {"genes": ["GENE_0000"], "layer": "counts"},
        },
    )
    assert response.status_code == 200
    run = response.json()
    assert run["status"] == "completed"
    assert run["workflow"] == "gene_expression"
    assert run["artifacts"]
    assert run["evidence"]

    fetched = client.get(f"/api/runs/{run['run_id']}")
    assert fetched.status_code == 200

    report_res = client.get(f"/api/runs/{run['run_id']}/report")
    assert report_res.status_code == 200
    assert "report_markdown" in report_res.json()

    runs_res = client.get("/api/runs")
    assert runs_res.status_code == 200
    assert any(item["run_id"] == run["run_id"] for item in runs_res.json()["runs"])

    artifact = run["artifacts"][0]
    download = client.get(f"/api/runs/{run['run_id']}/artifacts/{artifact['artifact_id']}")
    assert download.status_code == 200
