const url = 'https://feishu.soufe.cn/ip/batch';

export const translate = async (sourceValueList: Array<any>) => {
    return await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            field_value_list: sourceValueList
        }),
        headers: { 'Content-Type': 'application/json' }
    })
        .then(res => res.json())
        .then(json => { return json })
        .catch(err => console.error('error:' + err));
};
