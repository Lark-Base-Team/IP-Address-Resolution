import { useState, useEffect, useRef } from "react";
import { translate } from "./api";
import { Form, Button, Toast, Spin, Space } from "@douyinfe/semi-ui";
import {
  IFieldMeta as FieldMeta,
  FieldType,
  IOpenSegmentType,
  bitable,
  IRecord,
  ViewType,
  IGridView
} from "@lark-base-open/js-sdk";
import "./App.css";
import { icons } from "./icons";
import { useTranslation } from "react-i18next";

/** 表格，字段变化的时候刷新插件 */
export default function Ap() {

  const { t } = useTranslation();
  const [btnDisabled, setBtnDisabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [tableId, setTableId] = useState<string>("");
  const [viewId, setViewId] = useState<string>("");
  const [loadingTip, setLoadingTip] = useState('00%');
  const formApi = useRef<any>();

  const fieldInfo = useRef<{
    text: FieldMeta[];
    select: FieldMeta[];
  }>({ text: [], select: [] });

  useEffect(() => {
    setLoading(true);
    formApi.current.setValues({
      selectionMode: false
    });
    bitable.base.getSelection().then((selection: any) => {
      setTableId(selection.tableId);
      updateFields(selection.tableId);
      setViewId(selection.viewId);
      setLoading(false);
    });
  }, []);


  bitable.base.onSelectionChange((selection: any) => {
    setTableId(selection.data.tableId);
    setViewId(selection.data.viewId);
    updateFields(selection.data.tableId);
  });

  function updateFields(activeTableId: string) {
    formApi.current.setValues({
      targetField: "",
      sourceField: "",
      targetLang: "",
      selectionMode: false
    });
    bitable.base.getTableById(activeTableId).then((table) => {
      setLoading(true);
      const textArr: FieldMeta[] = [];
      const selectArr: FieldMeta[] = [];
      table.getFieldMetaList().then((m) => {
        Promise.allSettled(
          m.map(async (meta) => {
            switch (meta.type) {
              case FieldType.Text:
                textArr.push(meta);
                break;
              case FieldType.SingleSelect:
              case FieldType.MultiSelect:
                selectArr.push(meta);
                break;
              case FieldType.Lookup:
              case FieldType.Formula:
                const field = await table.getFieldById(meta.id);
                const proxyType = await field.getProxyType();
                if (proxyType === FieldType.Text) {
                  textArr.push(meta);
                } else if (
                  proxyType === FieldType.SingleSelect ||
                  proxyType === FieldType.MultiSelect
                ) {
                  selectArr.push(meta);
                }
                break;
              default:
                break;
            }
            return true;
          })
        ).finally(() => {
          fieldInfo.current.text = textArr;
          fieldInfo.current.select = selectArr;
          setLoading(false);
        });
      });
    });
  }

  const onClickStart = async () => {
    const {
      sourceField: sourceFieldId,
      targetField: targetFieldId,
      targetLang: targetLang,
      selectionMode: selectionMode
    } = formApi.current.getValues();
    if (!sourceFieldId) {
      Toast.error(t("choose.sourceField"));
      return;
    }
    if (!targetFieldId) {
      Toast.error(t("choose.targetField"));
      return;
    }
    if (!tableId) {
      Toast.error(t("err.table"));
      return;
    }
    setLoading(true);
    const table = await bitable.base.getTableById(tableId);
    const view = await table.getViewById(viewId!);
    const sourceField = await table.getFieldById(sourceFieldId);
    let sourceValueList: Array<any> = [];

    if (selectionMode) {
      const viewType = await view.getType();
      if (viewType == ViewType.Grid) {
        const selectedRecordIds = await (view as IGridView).getSelectedRecordIdList();
        if (selectedRecordIds.length === 0) {
          Toast.error(t("err.noRecordsSelected"));
          setLoading(false);
          return;
        }
        for (let i = 0; i < selectedRecordIds.length; i += 1) {
          const cellValue = await sourceField.getValue(selectedRecordIds[i]);
          sourceValueList.push({ record_id: selectedRecordIds[i], value: cellValue });
        }
      }
    } else {
      let recordIdData;
      let token = undefined as any;
      do {
        recordIdData = await sourceField.getFieldValueListByPage(token ? { pageToken: token, pageSize: 200 } : { pageSize: 200 });
        token = recordIdData.pageToken;
        sourceValueList.push(...recordIdData.fieldValues.map((v: any) => { v.record_id = v.recordId; return v }))
        setLoadingTip(`${((token > 200 ? (token - 200) : 0) / recordIdData.total * 100).toFixed(2)}%`)
      } while (recordIdData.hasMore);
      console.log(sourceValueList);
      console.log(await sourceField.getFieldValueList());
      sourceValueList = await sourceField.getFieldValueList()
    }

    // 按照每 100 个元素为一组进行划分
    for (let i = 0; i < sourceValueList.length; i += 100) {
      console.log(i);

      const toTranslateList: any = [];
      let batch: Array<any> = sourceValueList.slice(i, i + 100);
      batch.forEach(({ record_id, value }, index) => {
        if (Array.isArray(value)) {
          toTranslateList.push({
            record_id: record_id,
            text: value.map(({ type, text }: any) => text).join(""),
          });
        }
      });
      const { data: translateResult } = await translate(toTranslateList);
      console.log("🧑‍🎓 ~ onClickStart ~ translateResult:", translateResult)
      if (Array.isArray(translateResult)) {
        const records: Array<IRecord> = [];
        await translateResult.forEach(({ record_id, text }: any) =>
          records.push({
            recordId: record_id,
            fields:
            {
              [targetFieldId]: [
                { type: IOpenSegmentType.Text, text: text },
              ]
            }
          })
        );
        await table.setRecords(records);
      }
    }

    setLoading(false);
    Toast.success(t("success"));
  };

  const onFormChange = (e: any) => {
    const { sourceField, targetField } = e.values;
    if (!sourceField || !targetField) {
      setBtnDisabled(true);
    } else {
      setBtnDisabled(false);
    }
  };

  const { Select, Switch } = Form;

  return (
    <div>
      <Spin spinning={loading} tip={loadingTip}>
        <Form
          onChange={onFormChange}
          disabled={loading}
          getFormApi={(e) => { formApi.current = e; }}
        >
          <Select
            field="sourceField"
            label={t("choose.sourceField")}
            placeholder={t("choose")}
          >
            {fieldInfo.current.text.map((m) => {
              return (
                <Select.Option value={m.id} key={m.id}>
                  <div className="semi-select-option-text">
                    {/* @ts-ignore */}
                    {icons[m.type]}
                    {m.name}
                  </div>
                </Select.Option>
              );
            })}
          </Select>
          <Select
            field="targetField"
            label={t("choose.targetField")}
            placeholder={t("choose")}
          >
            {fieldInfo.current.text.map((m) => {
              return (
                <Select.Option value={m.id} key={m.id}>
                  <div className="semi-select-option-text">
                    {/* @ts-ignore */}
                    {icons[m.type]}
                    {m.name}
                  </div>
                </Select.Option>
              );
            })}
          </Select>
          <Switch
            field="selectionMode"
            label={t("switch.selectionMode")}
            labelPosition="left" />
        </Form>
      </Spin>
      <br></br>
      <Space>
        <Button disabled={btnDisabled} type="primary" className="bt1" loading={loading} onClick={onClickStart}>
          {t("start.btn")}
        </Button>
      </Space>
    </div>
  );
}
